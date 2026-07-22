package edu.kcg.rewriting_tool.service

class RewriteNotFoundException(id: Long) : RuntimeException("Rewrite history item $id was not found.")
