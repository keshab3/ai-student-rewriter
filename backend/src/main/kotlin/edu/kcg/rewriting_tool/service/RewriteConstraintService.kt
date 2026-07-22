package edu.kcg.rewriting_tool.service

import org.springframework.stereotype.Service

@Service
class RewriteConstraintService {
    fun normalizeAvoidWords(avoidWords: List<String>): List<String> {
        val seen = linkedSetOf<String>()
        return avoidWords
            .asSequence()
            .map { it.replace(Regex("\\s+"), " ").trim() }
            .filter { it.isNotBlank() }
            .map { it.take(120) }
            .filter { seen.add(it.lowercase()) }
            .take(30)
            .toList()
    }

    fun findAvoidedTerms(text: String, avoidWords: List<String>): List<String> =
        normalizeAvoidWords(avoidWords)
            .filter { term -> avoidPattern(term).containsMatchIn(text) }

    fun removeAvoidedTerms(text: String, avoidWords: List<String>): String {
        var repaired = text
        normalizeAvoidWords(avoidWords).forEach { term ->
            repaired = repaired.replace(avoidPattern(term), simpleReplacement(term))
        }
        return repaired.replace(Regex("\\s+([,.!?;:])"), "$1").replace(Regex("\\s+"), " ").trim()
    }

    private fun avoidPattern(term: String): Regex {
        val escaped = term.trim().split(Regex("\\s+")).joinToString("\\s+") { Regex.escape(it) }
        return if (term.matches(Regex("[A-Za-z0-9][A-Za-z0-9\\s'_-]*"))) {
            Regex("(?<![A-Za-z0-9])$escaped(?![A-Za-z0-9])", RegexOption.IGNORE_CASE)
        } else {
            Regex(escaped, RegexOption.IGNORE_CASE)
        }
    }

    private fun simpleReplacement(term: String): String =
        when (term.lowercase()) {
            "important" -> "valuable"
            "very important" -> "highly valuable"
            "good" -> "helpful"
            "bad" -> "not helpful"
            "help" -> "support"
            "use" -> "apply"
            "student", "students" -> "learner"
            "ai" -> "the tool"
            else -> "another suitable idea"
        }
}
