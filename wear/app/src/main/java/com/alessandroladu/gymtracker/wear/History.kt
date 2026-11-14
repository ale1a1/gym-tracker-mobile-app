package com.alessandroladu.gymtracker.wear

import java.time.Instant
import java.time.OffsetDateTime
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter

data class HistoryEntry(val date: LocalDate, val reps: List<Int>, val weight: Double?, val record: Boolean = false)

// One entry per finished session that included this exercise, newest first
fun historyEntries(sessions: List<SessionRow>, exerciseId: String): List<HistoryEntry> {
    // Oldest first, so each entry is compared with the best before it
    var best: PersonalBest? = null
    return sessions.sortedBy { it.completedAt }.mapNotNull { session ->
        val sets = session.sets.filter { it.exerciseId == exerciseId }.sortedBy { it.setIndex }
        val completedAt = session.completedAt ?: return@mapNotNull null
        if (sets.isEmpty()) return@mapNotNull null
        val weight = sets.first().weight
        val doneReps = sets.filter { it.completed }.map { it.reps }
        val top = doneReps.maxOrNull()
        val record = top != null && isNewRecord(best, weight, top)
        if (top != null && weight != null && (best == null || isNewRecord(best, weight, top))) best = PersonalBest(weight, top)
        HistoryEntry(
            date = parseTimestamp(completedAt).atZone(ZoneId.systemDefault()).toLocalDate(),
            reps = sets.map { it.reps },
            weight = weight,
            record = record,
        )
    }.sortedByDescending { it.date }
}

fun shiftPeriod(mode: String, start: LocalDate, direction: Long): LocalDate =
    if (mode == "week") start.plusWeeks(direction) else start.plusMonths(direction)

fun inPeriod(mode: String, start: LocalDate, date: LocalDate): Boolean =
    !date.isBefore(start) && date.isBefore(shiftPeriod(mode, start, 1))

fun periodLabel(mode: String, start: LocalDate): String =
    if (mode == "month") start.format(DateTimeFormatter.ofPattern("MMMM yyyy"))
    else "${start.format(DateTimeFormatter.ofPattern("d MMM"))} – ${start.plusDays(6).format(DateTimeFormatter.ofPattern("d MMM"))}"

// Supabase timestamps look like 2026-11-14T13:52:00.123+00:00 (offset, not Z)
fun parseTimestamp(value: String): Instant = OffsetDateTime.parse(value).toInstant()
