package edu.kcg.rewriting_tool.service

import edu.kcg.rewriting_tool.dto.ContactMessageRequest
import edu.kcg.rewriting_tool.dto.ContactMessageResponse
import edu.kcg.rewriting_tool.entity.ContactMessage
import edu.kcg.rewriting_tool.repository.ContactMessageRepository
import edu.kcg.rewriting_tool.repository.UserAccountRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDateTime

@Service
class ContactMessageService(
    private val contactMessageRepository: ContactMessageRepository,
    private val userAccountRepository: UserAccountRepository,
) {
    @Transactional
    fun create(username: String, request: ContactMessageRequest): ContactMessageResponse =
        contactMessageRepository.save(
            ContactMessage(
                name = request.name.trim(),
                email = request.email.trim(),
                subject = request.subject.trim(),
                message = request.message.trim(),
                createdAt = LocalDateTime.now(),
                owner = userAccountRepository.findByUsername(username.trim())
                    ?: throw UserAccountNotFoundException(username),
            ),
        ).toResponse()

    @Transactional(readOnly = true)
    fun listRecent(): List<ContactMessageResponse> =
        contactMessageRepository.findTop20ByOrderByCreatedAtDesc().map { it.toResponse() }

    private fun ContactMessage.toResponse(): ContactMessageResponse =
        ContactMessageResponse(
            id = requireNotNull(id),
            name = name,
            email = email,
            subject = subject,
            message = message,
            createdAt = createdAt,
        )
}
