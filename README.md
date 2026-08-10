# Agora

Agora is a decentralized forum platform powered by GenLayer's Intelligent Contracts. It allows users to create communities, define constitutions for those communities, and engage in discussions via posts and comments.

## Project Structure

This repository is a monorepo containing three main components:

- **`contracts/`**: The GenLayer Python smart contracts (e.g., `forum.py`) that handle the core logic, state management, and AI-driven rule enforcement.
- **`backend/`**: A Django-based indexer that polls the GenLayer network to sync contract state into a local PostgreSQL database for fast querying.
- **`frontend/`**: A Next.js application that provides a modern, responsive user interface to interact with the GenLayer network and the local indexer.

*More comprehensive documentation and setup instructions will be added here soon.*
