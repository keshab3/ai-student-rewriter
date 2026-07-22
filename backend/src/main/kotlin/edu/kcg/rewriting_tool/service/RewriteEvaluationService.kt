package edu.kcg.rewriting_tool.service

import edu.kcg.rewriting_tool.dto.RewriteEvaluationCheck
import edu.kcg.rewriting_tool.dto.RewriteEvaluationResponse
import edu.kcg.rewriting_tool.dto.RewriteMode
import org.springframework.stereotype.Service
import kotlin.math.abs
import kotlin.math.roundToInt

@Service
class RewriteEvaluationService(
    private val rewriteConstraintService: RewriteConstraintService,
) {
    fun evaluate(
        originalText: String,
        rewrittenText: String,
        mode: RewriteMode,
        avoidWords: List<String>,
    ): RewriteEvaluationResponse {
        val matchedAvoidWords = rewriteConstraintService.findAvoidedTerms(rewrittenText, avoidWords)
        val contentScore = estimateContentScore(originalText, rewrittenText)
        val structureScore = estimateStructureScore(originalText, rewrittenText)
        val avoidScore = if (matchedAvoidWords.isEmpty()) 100 else 65
        val unsupportedScore = estimateUnsupportedContentScore(originalText, rewrittenText)
        val completenessScore = estimateCompletenessScore(originalText, rewrittenText, contentScore)
        val levelCheck = estimateLevelCheck(rewrittenText, mode)
        val sentenceControlScore = estimateSentenceControlScore(rewrittenText, mode)
        val studentToneScore = estimateStudentToneScore(rewrittenText)
        val neutralToneScore = estimateNeutralToneScore(rewrittenText)
        val outputScore = estimateOutputRuleScore(rewrittenText)
        val grammarScore = estimateGrammarScore(rewrittenText)
        val technicalScore = estimateTechnicalTermScore(originalText, rewrittenText)
        val overall = listOf(
            contentScore,
            completenessScore,
            unsupportedScore,
            structureScore,
            avoidScore,
            levelCheck.score,
            sentenceControlScore,
            studentToneScore,
            neutralToneScore,
            outputScore,
            grammarScore,
            technicalScore,
        ).average().roundToInt()
        val decision = when {
            overall >= 90 -> "Ready to submit"
            overall >= 80 -> "Small corrections needed"
            overall >= 70 -> "Several improvements needed"
            else -> "Rewrite required"
        }
        val sentenceStats = sentenceStats(rewrittenText)

        return RewriteEvaluationResponse(
            checklist = listOf(
                RewriteEvaluationCheck(1, "Content match", "Checks whether the rewrite keeps the original topic and key words.", result(contentScore, 78, "topic match $contentScore%")),
                RewriteEvaluationCheck(2, "Meaning preservation", "Checks whether the main idea stays the same without changing the student's message.", result(((contentScore + unsupportedScore) / 2), 78, "meaning score ${(contentScore + unsupportedScore) / 2}%")),
                RewriteEvaluationCheck(3, "Missing information", "Checks if the output became too short or lost major details.", result(completenessScore, 78, "detail coverage $completenessScore%")),
                RewriteEvaluationCheck(4, "Unsupported additions", "Checks if the output adds new claims beyond the original.", result(unsupportedScore, 82, "added-content control $unsupportedScore%")),
                RewriteEvaluationCheck(5, "Structure and flow", "Checks paragraph count and approximate text organization.", result(structureScore, 78, "structure match $structureScore%")),
                RewriteEvaluationCheck(6, "Selected English level", "Checks whether the output fits the selected student level.", result(levelCheck.score, 78, "${levelCheck.detectedLevel}; selected ${mode.label}")),
                RewriteEvaluationCheck(7, "Sentence control", "Checks sentence length for the selected level.", result(sentenceControlScore, 78, "average ${sentenceStats.averageWords.roundToInt()} words, max ${sentenceStats.maxWords}")),
                RewriteEvaluationCheck(8, "Student tone", "Checks that the wording sounds like student assignment writing.", result(studentToneScore, 80, "student tone $studentToneScore%")),
                RewriteEvaluationCheck(9, "Neutral tone", "Checks that the rewrite avoids emotional, promotional, or opinion-heavy language.", result(neutralToneScore, 82, "neutral tone $neutralToneScore%")),
                RewriteEvaluationCheck(10, "Output format", "Checks that only the rewritten answer is returned.", result(outputScore, 90, "no labels, markdown, score text, or checklist text")),
                RewriteEvaluationCheck(11, "Technical terms and citations", "Checks whether technical-looking words, acronyms, and citations are likely retained.", result(technicalScore, 80, "term retention $technicalScore%")),
                RewriteEvaluationCheck(12, "Submission readiness", "Combines the checks into a final decision.", result(overall, 80, "$decision ($overall%)")),
            ),
            scores = mapOf(
                "Content match" to contentScore,
                "Meaning preservation" to contentScore,
                "Information completeness" to completenessScore,
                "No unsupported content" to unsupportedScore,
                "Structure and flow" to structureScore,
                "Avoid words" to avoidScore,
                "Selected English level" to levelCheck.score,
                "Sentence control" to sentenceControlScore,
                "Student tone" to studentToneScore,
                "Neutral tone" to neutralToneScore,
                "Output format" to outputScore,
                "Detected English level" to levelCheck.score,
                "Technical accuracy" to technicalScore,
                "Grammar and clarity" to grammarScore,
                "Submission readiness" to overall,
            ),
            finalDecision = decision,
            notes = buildNotes(
                matchedAvoidWords,
                levelCheck,
                sentenceControlScore,
                studentToneScore,
                neutralToneScore,
                outputScore,
            ),
        )
    }

    private fun estimateContentScore(originalText: String, rewrittenText: String): Int {
        val originalWords = keywordSet(originalText)
        if (originalWords.isEmpty()) return 100
        val rewrittenWords = keywordSet(rewrittenText)
        val overlap = originalWords.count { it in rewrittenWords }
        return ((overlap.toDouble() / originalWords.size) * 100).roundToInt().coerceIn(45, 100)
    }

    private fun estimateStructureScore(originalText: String, rewrittenText: String): Int {
        val originalParagraphs = originalText.trim().split(Regex("\\n\\s*\\n")).filter { it.isNotBlank() }.size.coerceAtLeast(1)
        val rewrittenParagraphs = rewrittenText.trim().split(Regex("\\n\\s*\\n")).filter { it.isNotBlank() }.size.coerceAtLeast(1)
        val distance = abs(originalParagraphs - rewrittenParagraphs)
        return (100 - distance * 12).coerceAtLeast(60)
    }

    private fun estimateUnsupportedContentScore(originalText: String, rewrittenText: String): Int {
        val originalWords = keywordSet(originalText)
        val rewrittenWords = keywordSet(rewrittenText)
        if (rewrittenWords.isEmpty()) return 0
        val addedWords = rewrittenWords.count { it !in originalWords }
        return (96 - addedWords.coerceAtMost(8) * 3).coerceIn(70, 96)
    }

    private fun estimateCompletenessScore(originalText: String, rewrittenText: String, contentScore: Int): Int {
        val originalCount = wordList(originalText).size.coerceAtLeast(1)
        val rewrittenCount = wordList(rewrittenText).size
        val ratio = rewrittenCount.toDouble() / originalCount
        val lengthScore = when {
            rewrittenText.isBlank() -> 0
            ratio < 0.45 -> 55
            ratio < 0.65 -> 72
            ratio > 2.35 -> 72
            ratio > 1.9 -> 82
            else -> 94
        }
        return ((contentScore + lengthScore) / 2).coerceIn(0, 100)
    }

    private fun estimateLevelCheck(text: String, mode: RewriteMode): LevelCheck {
        if (text.isBlank()) return LevelCheck("No English detected", 0)
        val complexity = complexityIndex(text)
        val detected = detectEnglishLevel(complexity)
        val target = when (mode) {
            RewriteMode.LEVEL_1_ADVANCED -> 70.0..100.0
            RewriteMode.LEVEL_2_CLEAR -> 61.0..78.0
            RewriteMode.LEVEL_3_NATURAL -> 52.0..68.0
            RewriteMode.LEVEL_4_SIMPLE -> 43.0..58.0
            RewriteMode.LEVEL_5_BASIC -> 0.0..50.0
            else -> 0.0..100.0
        }
        val distance = when {
            complexity < target.start -> target.start - complexity
            complexity > target.endInclusive -> complexity - target.endInclusive
            else -> 0.0
        }
        val score = (96 - distance * 3.0).roundToInt().coerceIn(58, 96)
        return LevelCheck(detected, score)
    }

    private fun estimateSentenceControlScore(text: String, mode: RewriteMode): Int {
        val stats = sentenceStats(text)
        if (stats.sentenceCount == 0) return 0
        return when (mode) {
            RewriteMode.LEVEL_5_BASIC -> sentenceLimitScore(stats, averageLimit = 10.0, maxLimit = 14)
            RewriteMode.LEVEL_4_SIMPLE -> sentenceLimitScore(stats, averageLimit = 13.0, maxLimit = 20)
            RewriteMode.LEVEL_3_NATURAL -> sentenceRangeScore(stats, averageRange = 8.0..18.0, maxLimit = 26)
            RewriteMode.LEVEL_2_CLEAR -> sentenceRangeScore(stats, averageRange = 10.0..24.0, maxLimit = 34)
            RewriteMode.LEVEL_1_ADVANCED -> sentenceRangeScore(stats, averageRange = 12.0..30.0, maxLimit = 42)
            else -> sentenceLimitScore(stats, averageLimit = 24.0, maxLimit = 38)
        }
    }

    private fun estimateStudentToneScore(text: String): Int {
        if (text.isBlank()) return 0
        val lower = text.lowercase()
        val metaPatterns = listOf(
            "as an ai",
            "here is",
            "here's",
            "rewritten text",
            "the revised text",
            "this response",
            "checklist",
            "score:",
            "you should",
            "the student should",
            "teacher feedback",
        )
        val penalty = metaPatterns.count { it in lower } * 12 +
            Regex("\\b(I will|we will)\\b", RegexOption.IGNORE_CASE).findAll(text).count() * 5
        return (94 - penalty).coerceIn(35, 94)
    }

    private fun estimateNeutralToneScore(text: String): Int {
        if (text.isBlank()) return 0
        val emotionalWords = listOf(
            "amazing",
            "incredible",
            "perfect",
            "terrible",
            "worst",
            "best",
            "obviously",
            "definitely",
            "guaranteed",
            "must",
            "always",
            "never",
            "disaster",
        )
        val hitCount = emotionalWords.sumOf { word ->
            Regex("\\b${Regex.escape(word)}\\b", RegexOption.IGNORE_CASE).findAll(text).count()
        }
        return (96 - hitCount * 5).coerceIn(50, 96)
    }

    private fun estimateOutputRuleScore(text: String): Int {
        if (text.isBlank()) return 0
        var score = 98
        val lower = text.trim().lowercase()
        if (lower.startsWith("rewritten text:") || lower.startsWith("output:") || lower.startsWith("answer:")) {
            score -= 35
        }
        if (Regex("(?m)^#{1,6}\\s+").containsMatchIn(text)) {
            score -= 20
        }
        if ("```" in text) {
            score -= 25
        }
        if ("checklist" in lower || "score:" in lower || "final decision" in lower) {
            score -= 25
        }
        if ((text.trim().startsWith("\"") && text.trim().endsWith("\"")) ||
            (text.trim().startsWith("'") && text.trim().endsWith("'"))
        ) {
            score -= 12
        }
        return score.coerceIn(40, 98)
    }

    private fun estimateGrammarScore(text: String): Int {
        if (text.isBlank()) return 0
        var score = 94
        if (Regex("\\s+[,.!?;:]").containsMatchIn(text)) score -= 8
        if (Regex("\\b(im|dont|cant|wont|didnt|doesnt|isnt|arent)\\b", RegexOption.IGNORE_CASE).containsMatchIn(text)) {
            score -= 12
        }
        if (Regex("(^|[.!?]\\s+)[a-z]").containsMatchIn(text)) score -= 5
        if (Regex("\\s{2,}").containsMatchIn(text)) score -= 5
        return score.coerceIn(45, 94)
    }

    private fun estimateTechnicalTermScore(originalText: String, rewrittenText: String): Int {
        val terms = technicalTerms(originalText)
        if (terms.isEmpty()) return 90
        val retained = terms.count { term -> rewrittenText.contains(term, ignoreCase = true) }
        return ((retained.toDouble() / terms.size) * 100).roundToInt().coerceIn(45, 100)
    }

    private fun sentenceLimitScore(stats: SentenceStats, averageLimit: Double, maxLimit: Int): Int {
        val averagePenalty = ((stats.averageWords - averageLimit).coerceAtLeast(0.0) * 4).roundToInt()
        val maxPenalty = ((stats.maxWords - maxLimit).coerceAtLeast(0) * 3)
        return (96 - averagePenalty - maxPenalty).coerceIn(55, 96)
    }

    private fun sentenceRangeScore(stats: SentenceStats, averageRange: ClosedFloatingPointRange<Double>, maxLimit: Int): Int {
        val lowPenalty = ((averageRange.start - stats.averageWords).coerceAtLeast(0.0) * 3).roundToInt()
        val highPenalty = ((stats.averageWords - averageRange.endInclusive).coerceAtLeast(0.0) * 3).roundToInt()
        val maxPenalty = ((stats.maxWords - maxLimit).coerceAtLeast(0) * 2)
        return (96 - lowPenalty - highPenalty - maxPenalty).coerceIn(55, 96)
    }

    private fun complexityIndex(text: String): Double {
        val words = wordList(text)
        if (words.isEmpty()) return 0.0
        val stats = sentenceStats(text)
        val averageWordLength = words.map { it.length }.average()
        val longWordRatio = words.count { it.length >= 8 }.toDouble() / words.size
        return averageWordLength * 5.2 + stats.averageWords * 1.6 + longWordRatio * 24
    }

    private fun detectEnglishLevel(complexity: Double): String =
        when {
            complexity <= 50 -> "Detected A1-A2 Basic English"
            complexity <= 58 -> "Detected A2-B1 Simple English"
            complexity <= 66 -> "Detected B1-B2 Natural English"
            complexity <= 72 -> "Detected B2-C1 Clear English"
            else -> "Detected C1-C2 Advanced English"
        }

    private fun sentenceStats(text: String): SentenceStats {
        val sentences = text
            .split(Regex("(?<=[.!?])\\s+"))
            .map { it.trim() }
            .filter { it.isNotBlank() }
            .ifEmpty { listOf(text.trim()).filter { it.isNotBlank() } }
        val counts = sentences.map { wordList(it).size }.filter { it > 0 }
        if (counts.isEmpty()) return SentenceStats(0, 0.0, 0)
        return SentenceStats(
            sentenceCount = counts.size,
            averageWords = counts.average(),
            maxWords = counts.max(),
        )
    }

    private fun result(score: Int, passAt: Int, detail: String): String =
        if (score >= passAt) {
            "Pass - $detail"
        } else {
            "Review - $detail"
        }

    private fun buildNotes(
        matchedAvoidWords: List<String>,
        levelCheck: LevelCheck,
        sentenceControlScore: Int,
        studentToneScore: Int,
        neutralToneScore: Int,
        outputScore: Int,
    ): String {
        val issues = mutableListOf<String>()
        if (matchedAvoidWords.isNotEmpty()) {
            issues += "Avoided term still appears: ${matchedAvoidWords.joinToString(", ")}."
        }
        if (levelCheck.score < 78) {
            issues += "${levelCheck.detectedLevel}; check selected level."
        }
        if (sentenceControlScore < 78) {
            issues += "Sentence length may not match the selected level."
        }
        if (studentToneScore < 80) {
            issues += "Student tone needs review."
        }
        if (neutralToneScore < 82) {
            issues += "Neutral tone needs review."
        }
        if (outputScore < 90) {
            issues += "Output includes label, markdown, or extra checklist-style text."
        }
        return issues.ifEmpty { listOf("Automatic checks passed for level, tone, format, and avoid words.") }
            .joinToString(" ")
    }

    private fun keywordSet(text: String): Set<String> =
        wordList(text)
            .asSequence()
            .filterNot { it in commonWords }
            .take(80)
            .toSet()

    private fun wordList(text: String): List<String> =
        Regex("\\b[A-Za-z][A-Za-z'-]*\\b")
            .findAll(text.lowercase())
            .map { it.value.trim('\'', '-') }
            .filter { it.isNotBlank() }
            .toList()

    private fun technicalTerms(text: String): Set<String> {
        val citations = Regex("\\([^)]*\\d{4}[^)]*\\)").findAll(text).map { it.value.trim() }
        val acronyms = Regex("\\b[A-Z]{2,}\\b").findAll(text).map { it.value.trim() }
        val mixedTerms = Regex("\\b[A-Za-z]+\\d+[A-Za-z0-9]*\\b").findAll(text).map { it.value.trim() }
        return (citations + acronyms + mixedTerms).filter { it.isNotBlank() }.toSet()
    }

    private data class SentenceStats(
        val sentenceCount: Int,
        val averageWords: Double,
        val maxWords: Int,
    )

    private data class LevelCheck(
        val detectedLevel: String,
        val score: Int,
    )

    private val commonWords = setOf(
        "this", "that", "with", "from", "have", "will", "would", "could", "should",
        "about", "because", "there", "their", "they", "them", "then", "than", "also",
        "into", "more", "some", "very", "just", "good", "make", "made", "using",
        "used", "does", "done", "each", "only", "like", "same", "many", "much", "when",
        "what", "where", "which", "while", "after", "before", "over", "under", "most",
        "main", "idea", "text", "work", "school", "student", "students",
    )
}
