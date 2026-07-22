package edu.kcg.rewriting_tool.dto

data class RewriteEvaluationResponse(
    val checklist: List<RewriteEvaluationCheck>,
    val scores: Map<String, Int>,
    val finalDecision: String,
    val notes: String,
)

data class RewriteEvaluationCheck(
    val no: Int,
    val check: String,
    val whatToExamine: String,
    val result: String,
)
