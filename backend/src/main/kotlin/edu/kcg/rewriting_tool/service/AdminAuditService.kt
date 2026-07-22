package edu.kcg.rewriting_tool.service

import edu.kcg.rewriting_tool.dto.AdminAuditLogResponse
import edu.kcg.rewriting_tool.dto.RewriteMode
import edu.kcg.rewriting_tool.entity.AdminAuditLog
import edu.kcg.rewriting_tool.repository.AdminAuditLogRepository
import edu.kcg.rewriting_tool.repository.UserAccountRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDateTime

@Service
class AdminAuditService(
    private val adminAuditLogRepository: AdminAuditLogRepository,
    private val userAccountRepository: UserAccountRepository,
) {
    @Transactional
    fun recordPromptSettingUpdate(username: String, mode: RewriteMode) {
        val actor = userAccountRepository.findByUsername(username)
        adminAuditLogRepository.save(
            AdminAuditLog(
                actor = actor,
                action = "PROMPT_SETTING_UPDATED",
                details = "Updated prompt setting for ${mode.name}.",
                createdAt = LocalDateTime.now(),
            ),
        )
    }

    @Transactional(readOnly = true)
    fun listRecent(): List<AdminAuditLogResponse> =
        adminAuditLogRepository.findTop20ByOrderByCreatedAtDesc().map { log ->
            AdminAuditLogResponse(
                id = requireNotNull(log.id),
                actorUsername = log.actor?.username,
                action = log.action,
                details = log.details,
                createdAt = log.createdAt,
            )
        }
}
