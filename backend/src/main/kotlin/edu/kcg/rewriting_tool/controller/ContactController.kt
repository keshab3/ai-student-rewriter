package edu.kcg.rewriting_tool.controller

import edu.kcg.rewriting_tool.dto.ContactMessageRequest
import edu.kcg.rewriting_tool.dto.ContactMessageResponse
import edu.kcg.rewriting_tool.service.ContactMessageService
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController

@RestController
class ContactController(
    private val contactMessageService: ContactMessageService,
) {
    @PostMapping("/api/contact")
    fun createMessage(
        authentication: Authentication,
        @Valid @RequestBody request: ContactMessageRequest,
    ): ResponseEntity<ContactMessageResponse> =
        ResponseEntity.status(HttpStatus.CREATED).body(contactMessageService.create(authentication.name ?: "", request))

    @GetMapping("/api/admin/contact-messages")
    fun listMessages(): List<ContactMessageResponse> =
        contactMessageService.listRecent()
}
