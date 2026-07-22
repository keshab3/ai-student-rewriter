package edu.kcg.rewriting_tool.service

class UserAccountNotFoundException(username: String) :
    RuntimeException("User account '$username' was not found.")
