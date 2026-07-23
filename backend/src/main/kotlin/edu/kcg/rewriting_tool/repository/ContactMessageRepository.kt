package edu.kcg.rewriting_tool.repository

import edu.kcg.rewriting_tool.entity.ContactMessage
import edu.kcg.rewriting_tool.entity.UserAccount
import org.springframework.data.jpa.repository.JpaRepository

interface ContactMessageRepository : JpaRepository<ContactMessage, Long> {
    fun findTop20ByOrderByCreatedAtDesc(): List<ContactMessage>
    fun deleteByOwner(owner: UserAccount)
}
