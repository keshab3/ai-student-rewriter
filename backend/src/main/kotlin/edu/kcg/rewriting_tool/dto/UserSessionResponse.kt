package edu.kcg.rewriting_tool.dto

data class UserSessionResponse(
    val username: String,
    val roles: List<String>,
    val displayName: String,
)
