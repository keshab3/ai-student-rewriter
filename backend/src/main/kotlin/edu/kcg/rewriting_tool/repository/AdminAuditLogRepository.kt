package edu.kcg.rewriting_tool.repository

import edu.kcg.rewriting_tool.entity.AdminAuditLog
import org.springframework.data.jpa.repository.JpaRepository

interface AdminAuditLogRepository : JpaRepository<AdminAuditLog, Long> {
    fun findTop20ByOrderByCreatedAtDesc(): List<AdminAuditLog>
}
