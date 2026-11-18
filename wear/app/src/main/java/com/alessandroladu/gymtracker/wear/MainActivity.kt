package com.alessandroladu.gymtracker.wear

import android.Manifest
import android.os.Build
import android.content.Intent
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
import androidx.compose.foundation.layout.offset
import androidx.compose.animation.core.animateFloat
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
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
import androidx.compose.ui.text.style.TextOverflow
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
import androidx.compose.material.icons.filled.PlayArrow
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
        handleRestOver(intent)
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

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleRestOver(intent)
    }

    // Opened by the rest alarm: wake the screen (also over the watch face) and flash "Rest is over"
    private fun handleRestOver(intent: Intent?) {
        if (intent?.getBooleanExtra(WorkoutAlerts.EXTRA_REST_OVER, false) != true) return
        intent.removeExtra(WorkoutAlerts.EXTRA_REST_OVER)
        setShowWhenLocked(true)
        setTurnScreenOn(true)
        viewModel.showRestOver()
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
        true -> {
          // A workout that was running when the app was closed: go straight back into it
          LaunchedEffect(Unit) {
              if (viewModel.state.value.live != null) navController.navigate("workout")
          }
          SwipeDismissableNavHost(navController = navController, startDestination = "workouts") {
            composable("workouts") {
                val state by viewModel.state.collectAsStateWithLifecycle()
                WorkoutListScreen(
                    state = state,
                    viewModel = viewModel,
                    onOpenWorkout = { navController.navigate("workout") },
                    onHistory = { id -> navController.navigate("workoutHistory/$id") },
                )
            }
            composable("preview/{workoutId}") { entry ->
                val state by viewModel.state.collectAsStateWithLifecycle()
                val workout = state.workouts.find { it.id == entry.arguments?.getString("workoutId") }
                if (workout == null) {
                    Message("Workout not found")
                } else {
                    val openWorkout = { navController.navigate("workout") { popUpTo("workouts") } }
                    WorkoutPreviewScreen(
                        state = state,
                        workout = workout,
                        onStart = { viewModel.startWorkout(workout) { openWorkout() } },
                        onSwitch = { mode -> viewModel.switchWorkout(workout, mode) { openWorkout() } },
                        onHistory = { navController.navigate("workoutHistory/${workout.id}") },
                    )
                }
            }
            composable("workoutHistory/{workoutId}") { entry ->
                val state by viewModel.state.collectAsStateWithLifecycle()
                val workout = state.workouts.find { it.id == entry.arguments?.getString("workoutId") }
                if (workout == null) Message("Workout not found") else WorkoutHistoryScreen(workout)
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
private fun WorkoutListScreen(
    state: UiState,
    viewModel: WorkoutViewModel,
    onOpenWorkout: () -> Unit,
    onHistory: (String) -> Unit,
) {
    val listState = rememberScalingLazyListState()
    // ▶ pressed on another workout while one is running: ask what to do with the running one
    var switchTo by remember { mutableStateOf<WorkoutRow?>(null) }
    ScreenScaffold(scrollState = listState) { padding ->
        ScalingLazyColumn(
            state = listState,
            contentPadding = padding.withBottomRoom(),
            autoCentering = null,
            verticalArrangement = Arrangement.spacedBy(8.dp), // a little space between workouts
            modifier = Modifier.fillMaxWidth(),
        ) {
            item { ListHeader { Text("Workouts", fontSize = 20.sp, fontWeight = FontWeight.Bold) } }
            state.error?.let { error -> item { ErrorText(error) { viewModel.clearError() } } }
            // Waiting for the cloud: a small spinner, nothing else (no "No workouts" flash)
            val waiting = !state.workoutsLoaded && state.error == null
            if (waiting) {
                item { SmallSpinner(Modifier.padding(top = 12.dp)) }
            } else if (state.workouts.isEmpty() && !state.loading) {
                item { Text("No workouts yet. Create them on the phone.", textAlign = TextAlign.Center) }
            }
            state.workouts.forEach { workout ->
                val running = state.live?.workout?.id == workout.id
                // Name with ▶ start/continue and history right on the list (no extra page)
                item {
                    // tapping the card opens the workout (starts it, or continues the running one)
                    val open = {
                        when {
                            running -> onOpenWorkout()
                            state.live != null -> switchTo = workout
                            else -> viewModel.startWorkout(workout) { onOpenWorkout() }
                        }
                    }
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(26.dp))
                            .background(if (running) Green else Color(0xFF26262A))
                            .clickable(enabled = !state.loading) { open() }
                            .padding(start = 18.dp, end = 8.dp, top = 8.dp, bottom = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            // Plain label: tapping anywhere on the card opens the workout (no full-name popup here)
                            Text(workout.title, fontWeight = FontWeight.Bold, fontSize = 15.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, color = Color.White)
                            Text(
                                if (running) "In progress" else "${workout.exercises.size} exercises",
                                fontSize = 12.sp,
                                color = if (running) Color.White else Color.Gray,
                            )
                        }
                        // ▶ start; the running workout has none (its green card already opens it)
                        if (!running) {
                            Box(
                                modifier = Modifier
                                    .size(38.dp)
                                    .clip(CircleShape)
                                    .background(Green)
                                    .clickable(enabled = !state.loading) { open() },
                                contentAlignment = Alignment.Center,
                            ) {
                                Icon(Icons.Filled.PlayArrow, contentDescription = "Start", tint = Color.White, modifier = Modifier.size(26.dp))
                            }
                        }
                        Box(
                            modifier = Modifier.size(38.dp).clip(CircleShape).background(SoftBlue)
                                .then(if (running) Modifier.border(2.dp, Color.White, CircleShape) else Modifier)
                                .clickable { onHistory(workout.id) },
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(AppIcons.History, contentDescription = "History", tint = Color(0xFF0B1F3A), modifier = Modifier.size(22.dp))
                        }
                    }
                }
            }
            if (!waiting) item {
                var confirmSignOut by remember { mutableStateOf(false) }
                // Icon buttons: refresh, and sign out (door, red border; second tap confirms)
                Row(
                    modifier = Modifier.padding(top = 15.dp),
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


        val current = state.live
        val next = switchTo
        if (next != null && current != null) {
            SwitchWorkoutDialog(
                current = current.workout.title,
                next = next.title,
                onChoice = { mode ->
                    switchTo = null
                    viewModel.switchWorkout(next, mode) { onOpenWorkout() }
                },
                onCancel = {
                    switchTo = null
                    onOpenWorkout()
                },
            )
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
    // Every set of every exercise ticked: show the congratulations screen (once, until dismissed)
    val setsLeft = live.exercises.sumOf { ex -> ex.done.count { !it } }

    // Full exercise name shown in a small popup when a (truncated) title is tapped
    var fullTitle by remember { mutableStateOf<String?>(null) }
    var altsOpen by remember { mutableStateOf<Int?>(null) } // exercise whose alternatives are showing

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
            contentPadding = padding.withBottomRoom().withTopRoom(50.dp),
            autoCentering = null,
            verticalArrangement = Arrangement.spacedBy(2.dp),
            modifier = Modifier.fillMaxWidth(),
        ) {
            state.error?.let { error -> item { ErrorText(error) { viewModel.clearError() } } }

            // All exercises, one after the other
            live.exercises.forEachIndexed { exerciseIndex, exercise ->
                item {
                    // Space above each exercise, so it separates from the one before
                    // Title block: space above to separate from the exercise before; the machine
                    // settings sit right under the name. One line only, "…" if still too long
                    Column(
                        modifier = Modifier.fillMaxWidth().padding(top = 22.dp, bottom = 2.dp, start = 12.dp, end = 12.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        NameText(exercise.row.name, fontSize = 16.sp, textAlign = TextAlign.Center) { fullTitle = exercise.row.name }
                        if (exercise.row.settings.isNotBlank()) {
                            Text("⚙ ${exercise.row.settings}", style = MaterialTheme.typography.bodySmall, textAlign = TextAlign.Center)
                        }
                    }
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
                if (exercise.row.notes.isNotBlank()) {
                    item { Text(exercise.row.notes, style = MaterialTheme.typography.bodySmall, textAlign = TextAlign.Center) }
                }
                // "Alternatives ▾" opens the names; tapping one swaps it in for today
                if (exercise.row.alternatives.isNotEmpty()) {
                    val open = altsOpen == exerciseIndex
                    item {
                        Text(
                            "⇄ Alternatives " + if (open) "▴" else "▾",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier
                                .padding(bottom = 2.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(if (open) StepperGrey else Color(0xFF26262A))
                                .clickable { altsOpen = if (open) null else exerciseIndex }
                                .padding(horizontal = 12.dp, vertical = 4.dp),
                        )
                    }
                    if (open) {
                        exercise.row.alternatives.forEachIndexed { altIndex, alt ->
                            item {
                                Text(
                                    alt.name,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                    textAlign = TextAlign.Center,
                                    modifier = Modifier
                                        .padding(horizontal = 16.dp)
                                        .fillMaxWidth()
                                        .clip(RoundedCornerShape(14.dp))
                                        .background(StepperGrey)
                                        .clickable {
                                            altsOpen = null
                                            viewModel.swapExercise(exerciseIndex, altIndex)
                                        }
                                        .padding(horizontal = 10.dp, vertical = 7.dp),
                                )
                            }
                        }
                    }
                }

                // One row: sets x reps, weight (tap to type the exact value), history
                item {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Text("${exercise.row.sets} × ${exercise.row.reps}", fontSize = 15.sp, fontWeight = FontWeight.Bold)
                        Text(
                            "${formatWeight(exercise.weight)}  ✎",
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier
                                .clip(RoundedCornerShape(14.dp))
                                .background(Color(0xFF2C2C30))
                                .clickable { onEditWeight(exerciseIndex) }
                                .padding(horizontal = 12.dp, vertical = 5.dp),
                        )
                        Box(
                            modifier = Modifier
                                .size(28.dp)
                                .clip(CircleShape)
                                .background(SoftBlue)
                                .clickable { onHistory(exerciseIndex) },
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(AppIcons.History, contentDescription = "History", tint = Color(0xFF0B1F3A), modifier = Modifier.size(18.dp))
                        }
                    }
                }

                if (exercise.increaseSuggested) {
                    item {
                        // Small orange pill (last time every set hit the target); tap to set the new weight
                        Row(
                            modifier = Modifier
                                .clip(RoundedCornerShape(12.dp))
                                .background(Orange)
                                .clickable { onEditWeight(exerciseIndex) }
                                .padding(start = 6.dp, end = 10.dp, top = 3.dp, bottom = 3.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(2.dp),
                        ) {
                            Icon(
                                AppIcons.ArrowUpward,
                                contentDescription = null,
                                tint = Color(0xFF1F1300),
                                modifier = Modifier.size(20.dp),
                            )
                            Text("Increase the weight today", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color(0xFF1F1300))
                        }
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

            }
        }

        state.restOverAtMillis?.let { at ->
            RestOverFlash(key = at, onFinished = { viewModel.clearRestOver() })
        }

        val restEndsAt = state.restEndsAtMillis
        // A rest that already ran out (e.g. the app was in the background) isn't shown as "0:00 · Skip"
        if (restEndsAt != null && restEndsAt > now) {
            RestBadge(
                label = state.restLabel,
                secondsLeft = ((restEndsAt - now) / 1000).coerceAtLeast(0),
                onSkip = { viewModel.skipRest() },
                modifier = Modifier.align(Alignment.TopCenter).padding(top = 30.dp),
            )
        } else if (state.restOverAtMillis == null) { // hidden while "Rest is over" flashes
            WorkoutHeader(
                elapsedSeconds = live.elapsedMillis(now) / 1000,
                paused = live.paused,
                onPauseToggle = { if (live.paused) viewModel.resume() else viewModel.pause() },
                onStop = { confirmEnd = true },
                modifier = Modifier.align(Alignment.TopCenter).padding(top = 30.dp),
            )
        }

        if (state.finishPrompt) {
            WorkoutCompleteScreen(
                title = live.workout.title,
                setsLeft = setsLeft,
                onFinish = { viewModel.finishWorkout() },
                onNotYet = { viewModel.dismissFinishPrompt() },
            )
        }

        fullTitle?.let { name -> FullNamePopup(name) { fullTitle = null } }

        if (confirmEnd) {
            EndWorkoutDialog(
                title = live.workout.title,
                onFinish = { confirmEnd = false; viewModel.finishWorkout() },
                onDiscard = { confirmEnd = false; viewModel.discardWorkout() },
                onCancel = { confirmEnd = false },
            )
        }
    }
}

// All sets done: congratulations; Finish stops the timer and saves the workout
@Composable
private fun WorkoutCompleteScreen(title: String, setsLeft: Int, onFinish: () -> Unit, onNotYet: () -> Unit) {
    Box(
        modifier = Modifier.fillMaxSize().background(Green),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text("💪", fontSize = 44.sp)
            Text("Congratulations!", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Color.White)
            Text(
                "$title finished",
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(horizontal = 24.dp),
            )
            if (setsLeft > 0) {
                Text(
                    if (setsLeft == 1) "1 set not ticked" else "$setsLeft sets not ticked",
                    fontSize = 12.sp,
                    color = Color(0xFFFFF3C4),
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
            Row(
                modifier = Modifier.padding(top = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    "✓ Finish",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    color = Green,
                    modifier = Modifier
                        .clip(RoundedCornerShape(20.dp))
                        .background(Color.White)
                        .clickable(onClick = onFinish)
                        .padding(horizontal = 16.dp, vertical = 9.dp),
                )
                Text(
                    "Not yet",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White,
                    modifier = Modifier
                        .clip(RoundedCornerShape(20.dp))
                        .border(2.dp, Color.White, RoundedCornerShape(20.dp))
                        .clickable(onClick = onNotYet)
                        .padding(horizontal = 14.dp, vertical = 7.dp),
                )
            }
        }
    }
}

// Sticky header: workout time with round pause/play and stop buttons
@Composable
private fun WorkoutHeader(
    elapsedSeconds: Long,
    paused: Boolean,
    onPauseToggle: () -> Unit,
    onStop: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(26.dp))
            .background(Color(0xFF1C1C1E))
            .padding(start = 14.dp, end = 6.dp, top = 5.dp, bottom = 5.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(
            formatDuration(elapsedSeconds),
            fontSize = 22.sp,
            fontWeight = FontWeight.Bold,
            color = if (paused) Orange else Color.White,
        )
        // Pause (orange, two bars) / Play (green, triangle)
        Box(
            modifier = Modifier.size(36.dp).clip(CircleShape).background(if (paused) Green else Orange).clickable(onClick = onPauseToggle),
            contentAlignment = Alignment.Center,
        ) {
            if (paused) {
                Icon(Icons.Filled.PlayArrow, contentDescription = "Resume", tint = Color.White, modifier = Modifier.size(24.dp))
            } else {
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    repeat(2) { Box(Modifier.size(width = 4.dp, height = 14.dp).background(Color(0xFF1F1300))) }
                }
            }
        }
        // Stop (red square)
        Box(
            modifier = Modifier.size(36.dp).clip(CircleShape).background(Red).clickable(onClick = onStop),
            contentAlignment = Alignment.Center,
        ) {
            Box(Modifier.size(12.dp).background(Color.White))
        }
    }
}

// Stop pressed: finish and save, discard, or keep going (three identical buttons)
@Composable
private fun EndWorkoutDialog(title: String, onFinish: () -> Unit, onDiscard: () -> Unit, onCancel: () -> Unit) {
    Box(
        modifier = Modifier.fillMaxSize().background(Color(0xF0000000)),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.padding(top = 8.dp, start = 24.dp, end = 24.dp),
        ) {
            Text("End $title?", fontSize = 17.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
            Column(
                modifier = Modifier.padding(top = 14.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                DialogButton("✓ Finish & save", Green, onFinish)
                DialogButton("✕ Discard progress", Red, onDiscard)
                DialogButton("Continue workout", Color(0xFF34343A), onCancel)
            }
        }
    }
}

// Same size, font and padding for every dialog choice; only the colour differs
@Composable
private fun DialogButton(label: String, color: Color, onClick: () -> Unit) {
    Text(
        label,
        modifier = Modifier
            .width(164.dp)
            .clip(RoundedCornerShape(20.dp))
            .background(color)
            .clickable(onClick = onClick)
            .padding(vertical = 9.dp),
        fontSize = 14.sp,
        fontWeight = FontWeight.Bold,
        color = Color.White,
        textAlign = TextAlign.Center,
    )
}

// Full-screen "Rest is over" that blinks for about a second, then goes away by itself
@Composable
private fun RestOverFlash(key: Long, onFinished: () -> Unit) {
    var visible by remember(key) { mutableStateOf(true) }
    LaunchedEffect(key) {
        repeat(3) {
            visible = true
            delay(280)
            visible = false
            delay(120)
        }
        visible = true
        delay(400)
        onFinished()
    }
    Box(
        modifier = Modifier.fillMaxSize().background(if (visible) Green else Color.Black),
        contentAlignment = Alignment.Center,
    ) {
        if (visible) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                // Play sign = back to work (the bicep means "workout done")
                Box(
                    modifier = Modifier.size(64.dp).clip(CircleShape).background(Color.White),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(Icons.Filled.PlayArrow, contentDescription = null, tint = Green, modifier = Modifier.size(44.dp))
                }
                Text("Rest is over", fontSize = 24.sp, fontWeight = FontWeight.Bold, color = Color.White, modifier = Modifier.padding(top = 8.dp))
                Text("Back to work", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Color.White)
            }
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
private fun WorkoutPreviewScreen(
    state: UiState,
    workout: WorkoutRow,
    onStart: () -> Unit,
    onSwitch: (WorkoutViewModel.EndMode) -> Unit,
    onHistory: () -> Unit,
) {
    val listState = rememberScalingLazyListState(initialCenterItemIndex = 0)
    val running = state.live?.workout?.id == workout.id
    val other = state.live?.takeIf { !running }
    var showSwitch by remember { mutableStateOf(false) }
    ScreenScaffold(scrollState = listState) { padding ->
        ScalingLazyColumn(state = listState, contentPadding = padding.withBottomRoom(), autoCentering = null, modifier = Modifier.fillMaxWidth()) {
            // Title with a round green play button beside it
            item {
                // Long titles wrap; the play button keeps its size and always stays on screen
                Row(
                    modifier = Modifier.fillMaxWidth().padding(start = 28.dp, end = 28.dp, top = 14.dp, bottom = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp, Alignment.CenterHorizontally),
                ) {
                    Text(
                        workout.title,
                        modifier = Modifier.weight(1f, fill = false),
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        maxLines = 2,
                        lineHeight = 22.sp,
                    )
                    Box(
                        modifier = Modifier
                            .size(46.dp)
                            .clip(CircleShape)
                            .background(if (state.loading) Color.Gray else Green)
                            .clickable(enabled = !state.loading, onClick = { if (other != null) showSwitch = true else onStart() }),
                        contentAlignment = Alignment.Center,
                    ) {
                        if (state.loading) {
                            // Three dots drawn in the exact centre (the "…" glyph sat low)
                            Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
                                repeat(3) { Box(Modifier.size(6.dp).clip(CircleShape).background(Color.White)) }
                            }
                        } else {
                            Icon(Icons.Filled.PlayArrow, contentDescription = "Start", tint = Color.White, modifier = Modifier.size(30.dp))
                        }
                    }
                    Box(
                        modifier = Modifier.size(38.dp).clip(CircleShape).background(SoftBlue).clickable(onClick = onHistory),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(AppIcons.History, contentDescription = "History", tint = Color(0xFF0B1F3A), modifier = Modifier.size(22.dp))
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

        if (showSwitch && other != null) {
            SwitchWorkoutDialog(
                current = other.workout.title,
                next = workout.title,
                onChoice = { mode ->
                    showSwitch = false
                    onSwitch(mode)
                },
                onCancel = { showSwitch = false },
            )
        }
    }
}

// Another workout is running: finish & save it or discard it (then start the new one), or go back to it
@Composable
private fun SwitchWorkoutDialog(
    current: String,
    next: String,
    onChoice: (WorkoutViewModel.EndMode) -> Unit,
    onCancel: () -> Unit,
) {
    Box(modifier = Modifier.fillMaxSize().background(Color(0xF0000000)), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.offset(y = (-16).dp).padding(start = 24.dp, end = 24.dp)) {
            Text(
                "$current is in progress",
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                "End it to start $next",
                fontSize = 12.sp,
                color = Color.Gray,
                textAlign = TextAlign.Center,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Column(modifier = Modifier.padding(top = 12.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
                DialogButton("✓ Finish & save", Green) { onChoice(WorkoutViewModel.EndMode.FINISH) }
                DialogButton("✕ Discard progress", Red) { onChoice(WorkoutViewModel.EndMode.DISCARD) }
                DialogButton("Continue workout", Color(0xFF34343A), onCancel)
            }
        }
    }
}

// A whole past workout on one screen (date, time, every exercise with weight and reps);
// ◀ ▶ step through the last 5 sessions
@Composable
private fun WorkoutHistoryScreen(workout: WorkoutRow) {
    var sessions by remember { mutableStateOf<List<SessionRow>?>(null) }
    var error by remember { mutableStateOf(false) }
    var index by remember { mutableStateOf(0) } // 0 = most recent
    var fullName by remember { mutableStateOf<String?>(null) }
    val listState = rememberScalingLazyListState(initialCenterItemIndex = 0)

    LaunchedEffect(workout.id) {
        runCatching { Repository.completedSessions(workout.id).take(5) }
            .onSuccess { sessions = it }
            .onFailure { error = true }
    }

    ScreenScaffold(scrollState = listState) { padding ->
        ScalingLazyColumn(
            state = listState,
            contentPadding = padding.withBottomRoom(),
            autoCentering = null,
            verticalArrangement = Arrangement.spacedBy(2.dp),
            modifier = Modifier.fillMaxWidth(),
        ) {
            item { Text(workout.title, fontSize = 16.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 12.dp)) }
            val all = sessions
            when {
                error -> item { ErrorText("Couldn't load history") }
                all == null -> item { Text("Loading…", fontSize = 13.sp) }
                all.isEmpty() -> item { Text("Not done yet", fontSize = 13.sp, color = Color.Gray) }
                else -> {
                    val session = all[index]
                    // ◀ date ▶  (◀ = older)
                    item {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            HistoryArrow("◀", enabled = index < all.lastIndex) { index++ }
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text(
                                    session.completedAt?.let {
                                        parseTimestamp(it).atZone(java.time.ZoneId.systemDefault()).format(DateTimeFormatter.ofPattern("EEE d MMM"))
                                    } ?: "",
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Bold,
                                )
                                Text("${index + 1} of ${all.size}", fontSize = 11.sp, color = Color.Gray)
                            }
                            HistoryArrow("▶", enabled = index > 0) { index-- }
                        }
                    }
                    // every exercise of that session: name, weight, reps
                    session.sets
                        .groupBy { it.exercisePosition }
                        .toSortedMap()
                        .values
                        .forEach { sets ->
                            val first = sets.first()
                            val reps = sets.sortedBy { it.setIndex }.joinToString("-") { it.reps.toString() }
                            item {
                                Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(horizontal = 16.dp, vertical = 2.dp)) {
                                    NameText(first.exerciseName, fontSize = 13.sp) { fullName = first.exerciseName }
                                    Text(
                                        (first.weight?.let { formatWeight(it) + "  " } ?: "") + "[$reps]",
                                        fontSize = 12.sp,
                                        color = SoftBlue,
                                    )
                                }
                            }
                        }
                }
            }
        }
        fullName?.let { name -> FullNamePopup(name) { fullName = null } }
    }
}

@Composable
private fun HistoryArrow(symbol: String, enabled: Boolean, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .size(32.dp)
            .clip(CircleShape)
            .background(if (enabled) Color(0xFF34343A) else Color(0xFF1C1C1E))
            .clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(symbol, fontSize = 13.sp, color = if (enabled) Color.White else Color.DarkGray)
    }
}

// One centred card per set, so nothing sits near the round edge:
// "Set 1" / − reps + / Mark done
@Composable
private fun SetRow(setNumber: Int, reps: Int, done: Boolean, onMinus: () -> Unit, onPlus: () -> Unit, onToggleDone: () -> Unit) {
    // [-] reps [+] [done] as one centred group (one "Sets" label sits above all the rows)
    Column(
        modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            RoundButton(onClick = onMinus, background = StepperGrey) { Text("−", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Color.White) }
            Text("$reps", fontSize = 22.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 2.dp))
            RoundButton(onClick = onPlus, background = StepperGrey) { Text("+", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Color.White) }
            // Done: always an outlined circle; only the tick turns green once the set is done
            Box(
                modifier = Modifier
                    .size(38.dp)
                    .clip(CircleShape)
                    .border(2.dp, Color.Gray, CircleShape)
                    .clickable(onClick = onToggleDone),
                contentAlignment = Alignment.Center,
            ) {
                Text("✓", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = if (done) Green else Color.Gray)
            }
        }
    }
}

@Composable
private fun RoundButton(onClick: () -> Unit, background: Color, content: @Composable () -> Unit) {
    Box(
        modifier = Modifier.size(38.dp).clip(CircleShape).background(background).clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) { content() }
}

// Big keypad: digits plus one decimal point, e.g. 99.5. Empty = no weight.
@Composable
private fun WeightKeypad(initial: Double?, onDone: (Double?) -> Unit) {
    var text by remember { mutableStateOf(initial?.let { if (it % 1.0 == 0.0) it.toLong().toString() else it.toString() } ?: "") }
    // The first key typed replaces the current weight (like a calculator); after that it appends
    var fresh by remember { mutableStateOf(true) }
    val listState = rememberScalingLazyListState()

    fun press(key: String) {
        if (fresh && key != "⌫") text = ""
        fresh = false
        text = when (key) {
            "⌫" -> text.dropLast(1)
            "." -> if (text.contains(".")) text else (if (text.isEmpty()) "0." else "$text.")
            else -> when {
                text.contains(".") && text.substringAfter(".").length >= 2 -> text
                !text.contains(".") && text.length >= 3 -> text // max 999.99 kg
                else -> text + key
            }
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
                // Compact, centred green Save
                CompactButton(
                    onClick = { onDone(text.trimEnd('.').takeIf { it.isNotEmpty() }?.toDoubleOrNull()) },
                    modifier = Modifier.padding(top = 6.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Green, contentColor = Color.White),
                ) {
                    Text(
                        "Save",
                        modifier = Modifier.padding(horizontal = 14.dp),
                        textAlign = TextAlign.Center,
                        fontWeight = FontWeight.Bold,
                    )
                }
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
                                (entry.weight?.let { " · ${formatWeight(it)}" } ?: ""),
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                }
            }
        }
    }
}

// ---------- small pieces ----------

// One-line bold name, cut with "…" when too long. Only a cut name is tappable (to show it in full).
@Composable
private fun NameText(
    name: String,
    fontSize: androidx.compose.ui.unit.TextUnit,
    color: Color = Color.Unspecified,
    textAlign: TextAlign? = null,
    onShowFull: () -> Unit,
) {
    var cut by remember(name) { mutableStateOf(false) }
    Text(
        name,
        modifier = if (cut) Modifier.clickable(onClick = onShowFull) else Modifier,
        fontSize = fontSize,
        fontWeight = FontWeight.Bold,
        color = color,
        textAlign = textAlign,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
        onTextLayout = { cut = it.hasVisualOverflow },
    )
}

// Small, subtle loading spinner: a thin ring with a short green arc turning
@Composable
private fun SmallSpinner(modifier: Modifier = Modifier) {
    val angle by androidx.compose.animation.core.rememberInfiniteTransition(label = "spinner").animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = androidx.compose.animation.core.infiniteRepeatable(
            androidx.compose.animation.core.tween(900, easing = androidx.compose.animation.core.LinearEasing),
        ),
        label = "angle",
    )
    androidx.compose.foundation.Canvas(modifier.size(22.dp)) {
        val stroke = androidx.compose.ui.graphics.drawscope.Stroke(width = 2.5.dp.toPx(), cap = androidx.compose.ui.graphics.StrokeCap.Round)
        drawArc(Color(0xFF34343A), 0f, 360f, useCenter = false, style = stroke)
        drawArc(Green, angle, 80f, useCenter = false, style = stroke)
    }
}

// Full name of a title cut with "…"; tap anywhere to close
@Composable
private fun FullNamePopup(name: String, onClose: () -> Unit) {
    Box(
        modifier = Modifier.fillMaxSize().background(Color(0xCC000000)).clickable(onClick = onClose),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            name,
            modifier = Modifier
                .padding(horizontal = 30.dp)
                .clip(RoundedCornerShape(16.dp))
                .background(Color(0xFF2C2C30))
                .padding(horizontal = 16.dp, vertical = 12.dp),
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center,
        )
    }
}

// Extra space at the top of a list (room for a sticky header drawn over it)
@Composable
private fun PaddingValues.withTopRoom(extra: androidx.compose.ui.unit.Dp): PaddingValues {
    val dir = LocalLayoutDirection.current
    return PaddingValues(
        start = calculateStartPadding(dir),
        end = calculateEndPadding(dir),
        top = calculateTopPadding() + extra,
        bottom = calculateBottomPadding(),
    )
}

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
private val SoftBlue = Color(0xFF93C5FD)
private val StepperGrey = Color(0xFF34343A)

@Composable
private fun Message(text: String) {
    Column(Modifier.fillMaxWidth().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(text, modifier = Modifier.padding(top = 40.dp))
    }
}

@Composable
private fun ErrorText(text: String, onDismiss: (() -> Unit)? = null) {
    Text(
        text,
        color = MaterialTheme.colorScheme.error,
        style = MaterialTheme.typography.bodySmall,
        textAlign = TextAlign.Center,
        maxLines = 3,
        overflow = TextOverflow.Ellipsis,
        modifier = if (onDismiss != null) Modifier.clickable(onClick = onDismiss) else Modifier,
    )
}

private fun formatDuration(totalSeconds: Long): String {
    val h = totalSeconds / 3600
    val m = (totalSeconds % 3600) / 60
    val s = totalSeconds % 60
    return if (h > 0) "%d:%02d:%02d".format(h, m, s) else "%02d:%02d".format(m, s)
}
