package com.alessandroladu.gymtracker.wear

import android.Manifest
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material3.AppScaffold
import androidx.wear.compose.material3.Button
import androidx.wear.compose.material3.ButtonDefaults
import androidx.wear.compose.material3.Card
import androidx.wear.compose.material3.CompactButton
import androidx.wear.compose.material3.FilledTonalButton
import androidx.wear.compose.material3.ListHeader
import androidx.wear.compose.material3.MaterialTheme
import androidx.wear.compose.material3.ScreenScaffold
import androidx.wear.compose.material3.Text
import androidx.wear.compose.material3.TimeText
import androidx.wear.compose.navigation.SwipeDismissableNavHost
import androidx.wear.compose.navigation.composable
import androidx.wear.compose.navigation.rememberSwipeDismissableNavController
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import kotlinx.coroutines.delay
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    private val viewModel: WorkoutViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Needed for the rest alarm and the timer on the watch face
        if (Build.VERSION.SDK_INT >= 33) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1)
        }
        setContent {
            val state by viewModel.state.collectAsStateWithLifecycle()

            // Keep the screen on during a workout so the timers and rest vibration keep running
            LaunchedEffect(state.live != null) {
                if (state.live != null) window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                else window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            }

            MaterialTheme {
                AppScaffold(timeText = { TimeText() }) {
                    GymTrackerApp(state, viewModel, this@MainActivity)
                }
            }
        }
    }
}

@Composable
private fun GymTrackerApp(state: UiState, viewModel: WorkoutViewModel, activity: ComponentActivity) {
    val navController = rememberSwipeDismissableNavController()

    when (state.signedIn) {
        null -> Message("Loading…")
        false -> SignInScreen(state, viewModel, activity)
        true -> SwipeDismissableNavHost(navController = navController, startDestination = "workouts") {
            composable("workouts") {
                WorkoutListScreen(state, viewModel) { navController.navigate("workout") }
            }
            composable("workout") {
                ActiveWorkoutScreen(
                    state = state,
                    viewModel = viewModel,
                    onEditWeight = { navController.navigate("weight") },
                    onHistory = { navController.navigate("history") },
                    onEnded = { navController.popBackStack("workouts", inclusive = false) },
                )
            }
            composable("history") {
                val live = state.live
                if (live == null) Message("No workout") else HistoryScreen(live.workout.id, live.exercises[live.current].row)
            }
            composable("weight") {
                val live = state.live
                if (live == null) {
                    Message("No workout")
                } else {
                    WeightKeypad(initial = live.exercises[live.current].weight) { weight ->
                        viewModel.setWeight(weight)
                        navController.popBackStack()
                    }
                }
            }
        }
    }
}

// ---------- screens ----------

@Composable
private fun SignInScreen(state: UiState, viewModel: WorkoutViewModel, activity: ComponentActivity) {
    val scope = rememberCoroutineScope()
    Column(
        modifier = Modifier.fillMaxWidth().padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text("Gym Tracker", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 24.dp))
        Text(
            "Sign in with the same Google account as the phone",
            textAlign = TextAlign.Center,
            style = MaterialTheme.typography.bodySmall,
            modifier = Modifier.padding(vertical = 8.dp),
        )
        Button(
            onClick = {
                scope.launch {
                    try {
                        val option = GetGoogleIdOption.Builder()
                            .setServerClientId(BuildConfig.GOOGLE_WEB_CLIENT_ID)
                            .setFilterByAuthorizedAccounts(false)
                            .build()
                        val request = GetCredentialRequest.Builder().addCredentialOption(option).build()
                        val credential = CredentialManager.create(activity).getCredential(activity, request).credential
                        if (credential is CustomCredential &&
                            credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL
                        ) {
                            viewModel.signIn(GoogleIdTokenCredential.createFrom(credential.data).idToken)
                        } else {
                            viewModel.showError("Unexpected sign-in response")
                        }
                    } catch (e: Exception) {
                        viewModel.showError("Google sign-in failed: ${e.message}")
                    }
                }
            },
            enabled = !state.loading,
        ) { Text(if (state.loading) "Signing in…" else "Sign in with Google") }
        state.error?.let { ErrorText(it) }
    }
}

@Composable
private fun WorkoutListScreen(state: UiState, viewModel: WorkoutViewModel, onOpen: () -> Unit) {
    val listState = rememberScalingLazyListState()
    ScreenScaffold(scrollState = listState) { padding ->
        ScalingLazyColumn(state = listState, contentPadding = padding, modifier = Modifier.fillMaxWidth()) {
            item { ListHeader { Text("Workouts") } }
            state.live?.let { live ->
                item {
                    Button(
                        onClick = onOpen,
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.tertiary),
                    ) { Text("▶ Continue ${live.workout.title}") }
                }
            }
            if (state.workouts.isEmpty() && !state.loading) {
                item { Text("No workouts yet. Create them on the phone.", textAlign = TextAlign.Center) }
            }
            state.workouts.forEach { workout ->
                item {
                    FilledTonalButton(
                        onClick = { viewModel.startWorkout(workout, onOpen) },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = !state.loading,
                    ) {
                        Column {
                            Text(workout.title, fontWeight = FontWeight.Bold)
                            Text("${workout.exercises.size} exercises", style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }
            }
            item {
                CompactButton(onClick = { viewModel.loadWorkouts() }) { Text(if (state.loading) "Loading…" else "Refresh") }
            }
            state.error?.let { error -> item { ErrorText(error) } }
        }
    }
}

@Composable
private fun ActiveWorkoutScreen(
    state: UiState,
    viewModel: WorkoutViewModel,
    onEditWeight: () -> Unit,
    onHistory: () -> Unit,
    onEnded: () -> Unit,
) {
    val live = state.live
    if (live == null) {
        LaunchedEffect(Unit) { onEnded() }
        return
    }
    val exercise = live.exercises[live.current]
    val listState = rememberScalingLazyListState()
    var confirmEnd by remember { mutableStateOf(false) }

    // Ticks once a second for the stopwatch and the rest countdown
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(Unit) {
        while (true) {
            now = System.currentTimeMillis()
            delay(1000)
        }
    }

    ScreenScaffold(scrollState = listState) { padding ->
        ScalingLazyColumn(state = listState, contentPadding = padding, modifier = Modifier.fillMaxWidth()) {
            item {
                Text(
                    formatDuration((now - live.startedAtMillis) / 1000),
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                )
            }

            state.restEndsAtMillis?.let { endsAt ->
                item {
                    Button(
                        onClick = { viewModel.skipRest() },
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.tertiary),
                    ) {
                        Text("${state.restLabel} ${formatDuration(((endsAt - now) / 1000).coerceAtLeast(0))} · Skip")
                    }
                }
            }

            item {
                Text(
                    "${live.current + 1}/${live.exercises.size} · ${exercise.row.name}",
                    style = MaterialTheme.typography.titleMedium,
                    textAlign = TextAlign.Center,
                )
            }
            item { Text("Target ${exercise.row.sets} × ${exercise.row.reps}", style = MaterialTheme.typography.bodySmall) }
            if (exercise.row.setRest != null || exercise.row.exerciseRest != null) {
                item {
                    Text(
                        "Rest ${exercise.row.setRest ?: live.workout.setRest}s" +
                            (exercise.row.exerciseRest?.let { ", ${it}s after" } ?: ""),
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
            }
            if (exercise.row.settings.isNotBlank()) {
                item { Text("⚙ ${exercise.row.settings}", style = MaterialTheme.typography.bodySmall, textAlign = TextAlign.Center) }
            }
            if (exercise.row.notes.isNotBlank()) {
                item { Text(exercise.row.notes, style = MaterialTheme.typography.bodySmall, textAlign = TextAlign.Center) }
            }
            exercise.lastReps?.let { last ->
                item { Text("Last: [${last.joinToString("-")}]", style = MaterialTheme.typography.bodySmall) }
            }
            item { CompactButton(onClick = onHistory) { Text("History") } }

            exercise.row.alternatives.forEach { alt ->
                item {
                    Text(
                        "Alt: ${alt.name}" + (if (alt.sets != null && alt.reps != null) " ${alt.sets}×${alt.reps}" else "") +
                            (if (alt.weight != null) " · ${formatWeight(alt.weight)}" else "") +
                            (if (alt.settings.isNotBlank()) " (${alt.settings})" else ""),
                        style = MaterialTheme.typography.bodySmall,
                        textAlign = TextAlign.Center,
                    )
                }
            }

            if (exercise.newRecord) {
                item {
                    Text("🏆 New record!", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                }
            }

            if (exercise.increaseSuggested) {
                item {
                    Card(onClick = onEditWeight, modifier = Modifier.fillMaxWidth()) {
                        Text("Last time you hit every set. Increase the weight today.", style = MaterialTheme.typography.bodySmall)
                    }
                }
            }

            // Weight: tap to type the exact value (no +/-)
            item {
                FilledTonalButton(onClick = onEditWeight, modifier = Modifier.fillMaxWidth()) {
                    Text("Weight: ${formatWeight(exercise.weight)}  ✎")
                }
            }

            exercise.reps.forEachIndexed { setIndex, reps ->
                item {
                    SetRow(
                        setNumber = setIndex + 1,
                        reps = reps,
                        done = exercise.done[setIndex],
                        onMinus = { viewModel.changeReps(setIndex, -1) },
                        onPlus = { viewModel.changeReps(setIndex, 1) },
                        onToggleDone = { viewModel.toggleSetDone(setIndex) },
                    )
                }
            }

            if (exercise.hitTarget && exercise.weight != null) {
                item { Text("Target hit! Increase the weight next time.", style = MaterialTheme.typography.bodySmall, textAlign = TextAlign.Center) }
            }

            item {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    CompactButton(onClick = { viewModel.goToExercise(live.current - 1) }, enabled = live.current > 0) { Text("◀ Prev") }
                    CompactButton(onClick = { viewModel.goToExercise(live.current + 1) }, enabled = live.current < live.exercises.lastIndex) { Text("Next ▶") }
                }
            }

            item {
                if (!confirmEnd) {
                    Button(onClick = { confirmEnd = true }, modifier = Modifier.fillMaxWidth()) { Text("End workout") }
                } else {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Button(onClick = { viewModel.finishWorkout() }, modifier = Modifier.fillMaxWidth()) { Text("✓ Finish & save") }
                        FilledTonalButton(onClick = { viewModel.discardWorkout() }, modifier = Modifier.fillMaxWidth()) { Text("✕ Discard") }
                        CompactButton(onClick = { confirmEnd = false }) { Text("Keep going") }
                    }
                }
            }

            state.error?.let { error -> item { ErrorText(error) } }
        }
    }
}

@Composable
private fun SetRow(setNumber: Int, reps: Int, done: Boolean, onMinus: () -> Unit, onPlus: () -> Unit, onToggleDone: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text("S$setNumber", style = MaterialTheme.typography.bodySmall)
        CompactButton(onClick = onMinus) { Text("−") }
        Text("$reps", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        CompactButton(onClick = onPlus) { Text("+") }
        CompactButton(
            onClick = onToggleDone,
            colors = if (done) ButtonDefaults.buttonColors() else ButtonDefaults.filledTonalButtonColors(),
        ) { Text(if (done) "✓" else "○") }
    }
}

// Big keypad: digits plus one decimal point, e.g. 99.5. Empty = no weight.
@Composable
private fun WeightKeypad(initial: Double?, onDone: (Double?) -> Unit) {
    var text by remember { mutableStateOf(initial?.let { if (it % 1.0 == 0.0) it.toLong().toString() else it.toString() } ?: "") }
    val listState = rememberScalingLazyListState()

    fun press(key: String) {
        text = when (key) {
            "⌫" -> text.dropLast(1)
            "." -> if (text.contains(".")) text else (if (text.isEmpty()) "0." else "$text.")
            else -> if (text.substringAfter(".", "").length >= 2 && text.contains(".")) text else (text + key).take(6)
        }
    }

    ScreenScaffold(scrollState = listState) { padding ->
        ScalingLazyColumn(state = listState, contentPadding = padding, modifier = Modifier.fillMaxWidth()) {
            item { Text(if (text.isEmpty()) "— kg" else "$text kg", fontSize = 28.sp, fontWeight = FontWeight.Bold) }
            listOf(listOf("1", "2", "3"), listOf("4", "5", "6"), listOf("7", "8", "9"), listOf(".", "0", "⌫")).forEach { row ->
                item {
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        row.forEach { key -> CompactButton(onClick = { press(key) }) { Text(key, fontSize = 18.sp) } }
                    }
                }
            }
            item {
                Button(
                    onClick = { onDone(text.trimEnd('.').takeIf { it.isNotEmpty() }?.toDoubleOrNull()) },
                    modifier = Modifier.fillMaxWidth(),
                ) { Text("Save") }
            }
        }
    }
}

// History of one exercise: last 10 sessions; with more, filter by month or week
@Composable
private fun HistoryScreen(workoutId: String, exercise: ExerciseRow) {
    val listState = rememberScalingLazyListState()
    var entries by remember { mutableStateOf<List<HistoryEntry>?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var mode by remember { mutableStateOf<String?>(null) } // null = last 10, "month", "week"
    var periodStart by remember { mutableStateOf(LocalDate.now()) }

    LaunchedEffect(workoutId, exercise.id) {
        runCatching { Repository.completedSessions(workoutId) }
            .onSuccess { sessions -> entries = historyEntries(sessions, exercise.id) }
            .onFailure { error = "Couldn't load history: ${it.message}" }
    }

    val all = entries.orEmpty()
    val shown = when (mode) {
        null -> all.take(10)
        else -> all.filter { inPeriod(mode!!, periodStart, it.date) }
    }

    ScreenScaffold(scrollState = listState) { padding ->
        ScalingLazyColumn(state = listState, contentPadding = padding, modifier = Modifier.fillMaxWidth()) {
            item { ListHeader { Text("History") } }
            item { Text(exercise.name, style = MaterialTheme.typography.bodySmall, textAlign = TextAlign.Center) }

            if (all.size > 10) {
                item {
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        listOf("month" to "Month", "week" to "Week").forEach { (m, label) ->
                            CompactButton(
                                onClick = {
                                    if (mode == m) {
                                        mode = null
                                    } else {
                                        mode = m
                                        val latest = all.first().date
                                        periodStart = if (m == "week") latest.with(DayOfWeek.MONDAY) else latest.withDayOfMonth(1)
                                    }
                                },
                                colors = if (mode == m) ButtonDefaults.buttonColors() else ButtonDefaults.filledTonalButtonColors(),
                            ) { Text(label) }
                        }
                    }
                }
            }
            if (mode != null) {
                item {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        CompactButton(onClick = { periodStart = shiftPeriod(mode!!, periodStart, -1) }) { Text("◀") }
                        Text(periodLabel(mode!!, periodStart), style = MaterialTheme.typography.bodySmall)
                        CompactButton(onClick = { periodStart = shiftPeriod(mode!!, periodStart, 1) }) { Text("▶") }
                    }
                }
            }

            when {
                error != null -> item { ErrorText(error!!) }
                entries == null -> item { Text("Loading…") }
                all.isEmpty() -> item { Text("No finished sessions yet", textAlign = TextAlign.Center) }
                shown.isEmpty() -> item { Text("Nothing in this ${mode}", textAlign = TextAlign.Center) }
            }
            shown.forEach { entry ->
                item {
                    Card(onClick = {}, modifier = Modifier.fillMaxWidth()) {
                        Text(entry.date.format(DateTimeFormatter.ofPattern("EEE d MMM yyyy")), fontWeight = FontWeight.Bold)
                        Text(
                            "${entry.reps.size} sets [${entry.reps.joinToString("-")}]" +
                                (entry.weight?.let { " · ${formatWeight(it)}" } ?: "") +
                                (if (entry.record) " 🏆" else ""),
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                }
            }
        }
    }
}

// ---------- small pieces ----------

@Composable
private fun Message(text: String) {
    Column(Modifier.fillMaxWidth().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(text, modifier = Modifier.padding(top = 40.dp))
    }
}

@Composable
private fun ErrorText(text: String) {
    Text(text, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall, textAlign = TextAlign.Center)
}

private fun formatDuration(totalSeconds: Long): String {
    val h = totalSeconds / 3600
    val m = (totalSeconds % 3600) / 60
    val s = totalSeconds % 60
    return if (h > 0) "%d:%02d:%02d".format(h, m, s) else "%02d:%02d".format(m, s)
}
