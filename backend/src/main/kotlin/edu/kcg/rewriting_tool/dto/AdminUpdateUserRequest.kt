package edu.kcg.rewriting_tool.dto

import jakarta.validation.constraints.Email
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size

data class AdminUpdateUserRequest(
    @field:NotBlank(message = "Username is required.")
    @field:Size(min = 3, max = 80, message = "Username must be between 3 and 80 characters.")
    val username: String,

    @field:Size(min = 6, max = 120, message = "Password must be between 6 and 120 characters.")
    val password: String?,

    @field:NotBlank(message = "Display name is required.")
    @field:Size(max = 120, message = "Display name must be 120 characters or fewer.")
    val displayName: String,

    @field:NotBlank(message = "Full name is required.")
    @field:Size(max = 160, message = "Full name must be 160 characters or fewer.")
    val fullName: String,

    @field:NotBlank(message = "Email is required.")
    @field:Email(message = "Email must be valid.")
    @field:Size(max = 160, message = "Email must be 160 characters or fewer.")
    val email: String,

    val enabled: Boolean,
)
