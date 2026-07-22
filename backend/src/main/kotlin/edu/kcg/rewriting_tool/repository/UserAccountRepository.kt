package edu.kcg.rewriting_tool.repository

import edu.kcg.rewriting_tool.entity.UserAccount
import org.springframework.data.jpa.repository.JpaRepository

interface UserAccountRepository : JpaRepository<UserAccount, Long> {
    fun findByUsername(username: String): UserAccount?
}
