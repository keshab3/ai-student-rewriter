package edu.kcg.rewriting_tool.dto

data class AdminSessionResponse(
    val username: String,
    val roles: List<String>,
)
