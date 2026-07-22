package edu.kcg.rewriting_tool.dto

import jakarta.validation.constraints.Email
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size

data class ContactMessageRequest(
    @field:NotBlank(message = "Name is required.")
    @field:Size(max = 120, message = "Name must be 120 characters or fewer.")
    val name: String,

    @field:NotBlank(message = "Email is required.")
    @field:Email(message = "Email must be valid.")
    @field:Size(max = 160, message = "Email must be 160 characters or fewer.")
    val email: String,

    @field:NotBlank(message = "Subject is required.")
    @field:Size(max = 160, message = "Subject must be 160 characters or fewer.")
    val subject: String,

    @field:NotBlank(message = "Message is required.")
    @field:Size(max = 1_500, message = "Message must be 1,500 characters or fewer.")
    val message: String,
)
