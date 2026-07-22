package edu.kcg.rewriting_tool.service

class UsernameAlreadyExistsException(username: String) :
    RuntimeException("Username '$username' is already registered.")
