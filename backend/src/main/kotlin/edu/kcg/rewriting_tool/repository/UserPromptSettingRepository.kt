package edu.kcg.rewriting_tool.repository

import edu.kcg.rewriting_tool.dto.RewriteMode
import edu.kcg.rewriting_tool.entity.UserAccount
import edu.kcg.rewriting_tool.entity.UserPromptSetting
import org.springframework.data.jpa.repository.JpaRepository

interface UserPromptSettingRepository : JpaRepository<UserPromptSetting, Long> {
    fun findAllByOwner(owner: UserAccount): List<UserPromptSetting>

    fun findByOwnerAndMode(owner: UserAccount, mode: RewriteMode): UserPromptSetting?

    fun deleteByOwner(owner: UserAccount)
}
