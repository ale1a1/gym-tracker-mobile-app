package com.alessandroladu.gymtracker.wear

import android.Manifest
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.draw.clip
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.calculateEndPadding
import androidx.compose.foundation.layout.calculateStartPadding
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
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
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material3.AppScaffold
import androidx.wear.compose.material3.Button
import androidx.wear.compose.material3.ButtonDefaults
import androidx.wear.compose.material3.Card
import androidx.wear.compose.material3.FilledIconButton
import androidx.wear.compose.material3.IconButtonDefaults
import androidx.wear.compose.material3.Icon
import androidx.wear.compose.material3.OutlinedIconButton
import androidx.compose.foundation.BorderStroke
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ExitToApp
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.ui.graphics.Color
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
        // Each screen collects the state itself: the nav graph keeps the first lambdas it was
        // given, so state passed in from here would go stale (taps saved but the screen not updating)
        true -> SwipeDismissableNavHost(navController = navController, startDestination = "workouts") {
            composable("workouts") {
                val state by viewModel.state.collectAsStateWithLifecycle()
                WorkoutListScreen(
                    state = state,
                    viewModel = viewModel,
                    onPreview = { id -> navController.navigate("preview/$id") },
                    onContinue = { navController.navigate("workout") },
                )
            }
            composable("preview/{workoutId}") { entry ->
                val state by viewModel.state.collectAsStateWithLifecycle()
                val workout = state.workouts.find { it.id == entry.arguments?.getString("workoutId") }
                if (workout == null) {
                    Message("Workout not found")
                } else {
                    WorkoutPreviewScreen(state, workout) {
                        viewModel.startWorkout(workout) { navController.navigate("workout") { popUpTo("workouts") } }
                    }
                }
            }
            composable("workout") {
                val state by viewModel.state.collectAsStateWithLifecycle()
                ActiveWorkoutScreen(
                    state = state,
                    viewModel = viewModel,
                    onEditWeight = { index -> navController.navigate("weight/$index") },
                    onHistory = { index -> navController.navigate("history/$index") },
                    onEnded = { navController.popBackStack("workouts", inclusive = false) },
                )
            }
            composable("history/{index}") { entry ->
                val state by viewModel.state.collectAsStateWithLifecycle()
                val index = entry.arguments?.getString("index")?.toIntOrNull() ?: 0
                val exercise = state.live?.exercises?.getOrNull(index)
                if (exercise == null) Message("No workout") else HistoryScreen(state.live!!.workout.id, exercise.row)
            }
            composable("weight/{index}") { entry ->
                val state by viewModel.state.collectAsStateWithLifecycle()
                val index = entry.arguments?.getString("index")?.toIntOrNull() ?: 0
                val exercise = state.live?.exercises?.getOrNull(index)
                if (exercise == null) {
                    Message("No workout")
                } else {
                    WeightKeypad(initial = exercise.weight) { weight ->
                        viewModel.setWeight(index, weight)
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
    // Google's account picker on the watch; returns an ID token for Supabase
    val googleClient = remember {
        GoogleSignIn.getClient(
            activity,
            GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                .requestIdToken(BuildConfig.GOOGLE_WEB_CLIENT_ID)
                .requestEmail()
                .build(),
        )
    }
    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        try {
            val account = GoogleSignIn.getSignedInAccountFromIntent(result.data).getResult(ApiException::class.java)
            val idToken = account.idToken
            if (idToken != null) viewModel.signIn(idToken) else viewModel.showError("Google didn't return an ID token")
        } catch (e: ApiException) {
            // 12501 = cancelled by the user
            if (e.statusCode != 12501) viewModel.showError("Google sign-in failed (code ${e.statusCode})")
        }
    }

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
                viewModel.clearError()
                // Always show the account picker (no silently reused account)
                googleClient.signOut().addOnCompleteListener { launcher.launch(googleClient.signInIntent) }
            },
            enabled = !state.loading,
        ) { Text(if (state.loading) "Signing in…" else "Sign in with Google") }
        state.error?.let { ErrorText(it) }
    }
}

@Composable
private fun WorkoutListScreen(state: UiState, viewModel: WorkoutViewModel, onPreview: (String) -> Unit, onContinue: () -> Unit) {
    val listState = rememberScalingLazyListState()
    ScreenScaffold(scrollState = listState) { padding ->
        ScalingLazyColumn(state = listState, contentPadding = padding.withBottomRoom(), autoCentering = null, modifier = Modifier.fillMaxWidth()) {
            item { ListHeader { Text("Workouts") } }
            state.error?.let { error -> item { ErrorText(error) } }
            state.live?.let { live ->
                item {
                    Button(
                        onClick = onContinue,
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
                        onClick = { onPreview(workout.id) },
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
                var confirmSignOut by remember { mutableStateOf(false) }
                // Icon buttons: refresh, and sign out (door, red border; second tap confirms)
                Row(
                    modifier = Modifier.padding(top = 24.dp),
                    horizontalArrangement = Arrangement.spacedBy(20.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    FilledIconButton(
                        onClick = { viewModel.loadWorkouts() },
                        enabled = !state.loading,
                        modifier = Modifier.size(40.dp),
                        colors = IconButtonDefaults.filledIconButtonColors(containerColor = Orange, contentColor = Color(0xFF1F1300)),
                    ) {
                        Icon(Icons.Filled.Refresh, contentDescription = "Refresh")
                    }
                    if (!confirmSignOut) {
                        OutlinedIconButton(
                            onClick = { confirmSignOut = true },
                            modifier = Modifier.size(40.dp),
                            border = BorderStroke(2.dp, Red),
                        ) {
                            Icon(Icons.AutoMirrored.Filled.ExitToApp, contentDescription = "Sign out", tint = Red)
                        }
                    } else {
                        CompactButton(
                            onClick = { viewModel.signOut() },
                            colors = ButtonDefaults.buttonColors(containerColor = Red),
                        ) { Text("Sign out?", color = Color.White, fontWeight = FontWeight.Bold) }
                    }
                }
            }
        }
    }
}

@Composable
private fun ActiveWorkoutScreen(
    state: UiState,
    viewModel: WorkoutViewModel,
    onEditWeight: (Int) -> Unit,
    onHistory: (Int) -> Unit,
    onEnded: () -> Unit,
) {
    val live = state.live
    if (live == null) {
        LaunchedEffect(Unit) { onEnded() }
        return
    }
    // Starts at the top (no centring gap above the timer)
    val listState = rememberScalingLazyListState(initialCenterItemIndex = 0)
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
        ScalingLazyColumn(
            state = listState,
            contentPadding = padding.withBottomRoom(),
            autoCentering = null,
            modifier = Modifier.fillMaxWidth(),
        ) {
            item {
                Row(
                    modifier = Modifier.padding(top = 14.dp, bottom = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Text(
                        formatDuration(live.elapsedMillis(now) / 1000),
                        fontSize = 24.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (live.paused) Color(0xFFF59E0B) else Color.Unspecified,
                    )
                    if (live.paused) {
                        CompactButton(onClick = { viewModel.resume() }, colors = ButtonDefaults.buttonColors(containerColor = Green)) {
                            Text("▶ Resume", color = Color.White, fontWeight = FontWeight.Bold)
                        }
                    } else {
                        CompactButton(onClick = { viewModel.pause() }, colors = ButtonDefaults.filledTonalButtonColors()) { Text("Pause") }
                    }
                }
            }

            state.error?.let { error -> item { ErrorText(error) } }

            // All exercises, one after the other
            live.exercises.forEachIndexed { exerciseIndex, exercise ->
                item {
                    ListHeader {
                        Text(
                            "${exerciseIndex + 1}. ${exercise.row.name}",
                            textAlign = TextAlign.Center,
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                }
                item {
                    Text(
                        "Target ${exercise.row.sets} × ${exercise.row.reps}" +
                            (exercise.lastReps?.let { "  ·  Last [${it.joinToString("-")}]" } ?: ""),
                        style = MaterialTheme.typography.bodySmall,
                        textAlign = TextAlign.Center,
                    )
                }
                if (exercise.row.setRest != null || exercise.row.exerciseRest != null) {
                    item {
                        Text(
                            "Rest ${exercise.row.setRest ?: live.workout.setRest}s" +
                                (exercise.row.exerciseRest?.let { ", ${it}s after" } ?: ""),
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                }
                // Settings on the left, a small History chip beside them (same size as the subtitle)
                item {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        if (exercise.row.settings.isNotBlank()) {
                            Text("⚙ ${exercise.row.settings}", style = MaterialTheme.typography.bodySmall)
                        }
                        Text(
                            "History",
                            style = MaterialTheme.typography.bodySmall,
                            fontWeight = FontWeight.Bold,
                            color = Orange,
                            modifier = Modifier
                                .clip(RoundedCornerShape(10.dp))
                                .border(1.dp, Orange, RoundedCornerShape(10.dp))
                                .clickable { onHistory(exerciseIndex) }
                                .padding(horizontal = 8.dp, vertical = 2.dp),
                        )
                    }
                }
                if (exercise.row.notes.isNotBlank()) {
                    item { Text(exercise.row.notes, style = MaterialTheme.typography.bodySmall, textAlign = TextAlign.Center) }
                }
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
                    item { Text("🏆 New record!", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold) }
                }
                if (exercise.increaseSuggested) {
                    item {
                        // Small orange pill (last time every set hit the target); tap to set the new weight
                        Text(
                            "⬆ Increase the weight today",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF1F1300),
                            modifier = Modifier
                                .clip(RoundedCornerShape(12.dp))
                                .background(Color(0xFFF59E0B))
                                .clickable { onEditWeight(exerciseIndex) }
                                .padding(horizontal = 10.dp, vertical = 4.dp),
                        )
                    }
                }

                // Weight: tap to type the exact value (no +/-)
                // Small centred pill: "50 kg ✎"
                item {
                    CompactButton(
                        onClick = { onEditWeight(exerciseIndex) },
                        colors = ButtonDefaults.filledTonalButtonColors(),
                    ) {
                        Text(
                            "${formatWeight(exercise.weight)}  ✎",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            textAlign = TextAlign.Center,
                        )
                    }
                }

                exercise.reps.forEachIndexed { setIndex, reps ->
                    item {
                        SetRow(
                            setNumber = setIndex + 1,
                            reps = reps,
                            done = exercise.done[setIndex],
                            onMinus = { viewModel.changeReps(exerciseIndex, setIndex, -1) },
                            onPlus = { viewModel.changeReps(exerciseIndex, setIndex, 1) },
                            onToggleDone = { viewModel.toggleSetDone(exerciseIndex, setIndex) },
                        )
                    }
                }

                if (exercise.hitTarget && exercise.weight != null) {
                    item { Text("Target hit! Increase the weight next time.", style = MaterialTheme.typography.bodySmall, textAlign = TextAlign.Center) }
                }
            }

            item {
                if (!confirmEnd) {
                    Button(onClick = { confirmEnd = true }, modifier = Modifier.fillMaxWidth().padding(top = 12.dp)) { Text("End workout") }
                } else {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Button(onClick = { viewModel.finishWorkout() }, modifier = Modifier.fillMaxWidth()) { Text("✓ Finish & save") }
                        FilledTonalButton(
                            onClick = { viewModel.discardWorkout() },
                            modifier = Modifier.fillMaxWidth(0.85f),
                            colors = ButtonDefaults.filledTonalButtonColors(containerColor = MaterialTheme.colorScheme.errorContainer),
                        ) { Text("✕ Discard") }
                        CompactButton(onClick = { confirmEnd = false }) { Text("Keep going") }
                    }
                }
            }
        }

        state.restEndsAtMillis?.let { endsAt ->
            RestBadge(
                label = state.restLabel,
                secondsLeft = ((endsAt - now) / 1000).coerceAtLeast(0),
                onSkip = { viewModel.skipRest() },
                modifier = Modifier.align(Alignment.TopCenter).padding(top = 30.dp),
            )
        }
    }
}

// Sticky orange badge at the top while resting; the list keeps scrolling underneath
@Composable
private fun RestBadge(label: String, secondsLeft: Long, onSkip: () -> Unit, modifier: Modifier = Modifier) {
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(24.dp))
            .background(Color(0xFFF59E0B))
            .padding(start = 14.dp, end = 6.dp, top = 6.dp, bottom = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Column {
            Text(label, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFF1F1300))
            Text(formatDuration(secondsLeft), fontSize = 22.sp, fontWeight = FontWeight.Bold, color = Color(0xFF1F1300))
        }
        Text(
            "Skip",
            fontSize = 13.sp,
            fontWeight = FontWeight.Bold,
            color = Color.White,
            modifier = Modifier
                .clip(RoundedCornerShape(16.dp))
                .background(Color(0xFF1F1300))
                .clickable(onClick = onSkip)
                .padding(horizontal = 12.dp, vertical = 8.dp),
        )
    }
}

// A workout before starting it: exercises, sets × reps, weight, settings, and Start
@Composable
private fun WorkoutPreviewScreen(state: UiState, workout: WorkoutRow, onStart: () -> Unit) {
    val listState = rememberScalingLazyListState(initialCenterItemIndex = 0)
    val running = state.live?.workout?.id == workout.id
    ScreenScaffold(scrollState = listState) { padding ->
        ScalingLazyColumn(state = listState, contentPadding = padding.withBottomRoom(), autoCentering = null, modifier = Modifier.fillMaxWidth()) {
            // Title with a round green play button beside it
            item {
                Row(
                    modifier = Modifier.padding(top = 14.dp, bottom = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Text(workout.title, fontSize = 22.sp, fontWeight = FontWeight.Bold)
                    Box(
                        modifier = Modifier
                            .size(46.dp)
                            .clip(CircleShape)
                            .background(if (state.loading) Color.Gray else Green)
                            .clickable(enabled = !state.loading, onClick = onStart),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(if (state.loading) "…" else "▶", fontSize = 22.sp, color = Color.White, fontWeight = FontWeight.Bold)
                    }
                }
            }
            if (running) {
                item { Text("In progress: tap ▶ to continue", style = MaterialTheme.typography.bodySmall) }
            }
            state.error?.let { error -> item { ErrorText(error) } }
            workout.exercises.forEachIndexed { index, ex ->
                item {
                    Card(onClick = {}, modifier = Modifier.fillMaxWidth()) {
                        Text("${index + 1}. ${ex.name}", fontWeight = FontWeight.Bold)
                        Text(
                            "${ex.sets} × ${ex.reps}" + (ex.weight?.let { " · ${formatWeight(it)}" } ?: ""),
                            style = MaterialTheme.typography.bodySmall,
                        )
                        if (ex.settings.isNotBlank()) Text("⚙ ${ex.settings}", style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
        }
    }
}

// One centred card per set, so nothing sits near the round edge:
// "Set 1" / − reps + / Mark done
@Composable
private fun SetRow(setNumber: Int, reps: Int, done: Boolean, onMinus: () -> Unit, onPlus: () -> Unit, onToggleDone: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("Set $setNumber", style = MaterialTheme.typography.labelMedium)
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            FilledTonalButton(onClick = onMinus) { Text("−", fontSize = 22.sp) }
            Text("$reps", fontSize = 28.sp, fontWeight = FontWeight.Bold)
            FilledTonalButton(onClick = onPlus) { Text("+", fontSize = 22.sp) }
        }
        CompactButton(
            onClick = onToggleDone,
            modifier = Modifier.padding(top = 6.dp),
            colors = if (done) ButtonDefaults.buttonColors() else ButtonDefaults.filledTonalButtonColors(),
        ) { Text(if (done) "✓ Done" else "Mark done", fontWeight = FontWeight.Bold) }
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
        ScalingLazyColumn(state = listState, contentPadding = padding.withBottomRoom(), autoCentering = null, modifier = Modifier.fillMaxWidth()) {
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
        ScalingLazyColumn(state = listState, contentPadding = padding.withBottomRoom(), autoCentering = null, modifier = Modifier.fillMaxWidth()) {
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

// Extra space at the bottom of lists so the last card can scroll fully into view on the round screen
@Composable
private fun PaddingValues.withBottomRoom(): PaddingValues {
    val dir = LocalLayoutDirection.current
    return PaddingValues(
        start = calculateStartPadding(dir),
        end = calculateEndPadding(dir),
        top = calculateTopPadding(),
        bottom = calculateBottomPadding() + 60.dp,
    )
}

private val Green = Color(0xFF10B981)
private val Red = Color(0xFFEF4444)
private val Orange = Color(0xFFF59E0B)

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
