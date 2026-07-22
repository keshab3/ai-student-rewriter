package edu.kcg.rewriting_tool

import edu.kcg.rewriting_tool.dto.RewriteMode
import edu.kcg.rewriting_tool.service.AiRewriteClient
import edu.kcg.rewriting_tool.service.RewriteConstraintService
import edu.kcg.rewriting_tool.service.RewriteEvaluationService
import kotlin.test.Test
import kotlin.test.assertContains
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class AiRewriteClientTests {
    private val client = AiRewriteClient()

    @Test
    fun `grammar fix cleans common student writing issues`() {
        val rewritten = client.rewrite("im a student and i dont write good", RewriteMode.GRAMMAR_FIX)

        assertContains(rewritten, "I am")
        assertContains(rewritten, "I do not")
        assertTrue(rewritten.endsWith("."))
    }

    @Test
    fun `academic rewrite makes wording more formal`() {
        val rewritten = client.rewrite("technology is good and it can help students", RewriteMode.ACADEMIC_REWRITE)

        assertContains(rewritten, "beneficial")
        assertContains(rewritten, "support")
    }

    @Test
    fun `advanced level does not add fake helper wording`() {
        val rewritten = client.rewrite(
            "technology is good and students use it to learn",
            RewriteMode.LEVEL_1_ADVANCED,
        )

        assertContains(rewritten, "beneficial")
        assertContains(rewritten, "apply")
        assertFalse(rewritten.contains("advanced student perspective", ignoreCase = true))
    }

    @Test
    fun `basic level uses short direct sentences`() {
        val rewritten = client.rewrite(
            "Technology is important because students use it to complete assignments, communicate with classmates, and understand lessons more clearly.",
            RewriteMode.LEVEL_5_BASIC,
        )
        val maxWords = rewritten
            .split(Regex("[.!?]"))
            .map { sentence -> Regex("\\b[A-Za-z][A-Za-z'-]*\\b").findAll(sentence).count() }
            .maxOrNull()
            ?: 0

        assertTrue(maxWords <= 12, "Expected short basic sentences, got: $rewritten")
        assertContains(rewritten, "finish school work")
        assertContains(rewritten.lowercase(), "talk with classmates")
        assertContains(rewritten.lowercase(), "learn lessons better")
    }

    @Test
    fun `evaluation verifies level tone and output format`() {
        val evaluationService = RewriteEvaluationService(RewriteConstraintService())
        val evaluation = evaluationService.evaluate(
            originalText = "Technology helps students complete assignments and understand lessons clearly.",
            rewrittenText = "Technology helps students finish school work. Students learn lessons better.",
            mode = RewriteMode.LEVEL_5_BASIC,
            avoidWords = emptyList(),
        )

        assertTrue(evaluation.checklist.any { it.check == "Selected English level" && it.result.contains("Detected") })
        assertTrue(evaluation.checklist.any { it.check == "Student tone" && it.result.startsWith("Pass") })
        assertTrue(evaluation.checklist.any { it.check == "Neutral tone" && it.result.startsWith("Pass") })
        assertTrue(evaluation.checklist.any { it.check == "Output format" && it.result.startsWith("Pass") })
    }

    @Test
    fun `evaluation flags avoid words and extra output labels`() {
        val evaluationService = RewriteEvaluationService(RewriteConstraintService())
        val evaluation = evaluationService.evaluate(
            originalText = "Technology helps students write clearly.",
            rewrittenText = "Rewritten text: Technology is amazing and helps students write clearly.",
            mode = RewriteMode.LEVEL_3_NATURAL,
            avoidWords = listOf("amazing"),
        )

        assertTrue(evaluation.checklist.any { it.check == "Output format" && it.result.startsWith("Review") })
        assertTrue(evaluation.scores.getValue("Avoid words") < 100)
        assertContains(evaluation.notes, "Avoided term still appears")
    }
}
