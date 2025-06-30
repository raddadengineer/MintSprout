# MintSprout - Financial Literacy Web App for Kids

## Overview

MintSprout is a full-stack financial literacy web application designed to teach money management to children aged 5-15. The application enables parents to assign jobs to their children, track payments, and guide kids through financial learning with automatic allocation of earnings into spending, savings, and investment categories.

## System Architecture

The application follows a modern full-stack architecture with clear separation between client and server components:

### Frontend Architecture
- **Framework**: React 18 with TypeScript for type safety
- **Styling**: Tailwind CSS with custom design system using CSS variables
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **State Management**: TanStack React Query for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Build Tool**: Vite for fast development and optimized builds

### Backend Architecture
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js for REST API endpoints
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Authentication**: JWT-based authentication with bcrypt for password hashing
- **Session Management**: PostgreSQL session storage with connect-pg-simple

### Data Storage Solutions
- **Primary Database**: PostgreSQL (configured via Neon Database)
- **ORM**: Drizzle ORM with automatic type generation
- **Migrations**: Drizzle Kit for database schema management
- **Connection**: Neon serverless driver for edge-compatible database access

## Key Components

### Database Schema
The application uses a comprehensive schema with the following key entities:
- **Families**: Support for multiple family units
- **Users**: Authentication and role-based access (parent/child)
- **Children**: Child profiles with financial tracking
- **Jobs**: Task assignment with status tracking and recurrence patterns
- **Payments**: Automatic allocation into spending, savings, Roth IRA, and brokerage
- **Allocation Settings**: Customizable percentage splits per child
- **Learning**: Lessons, quizzes, and progress tracking
- **Achievements**: Gamification elements

### Authentication & Authorization
- JWT-based stateless authentication
- Role-based access control (parent vs child permissions)
- Secure password hashing with bcrypt
- Session management for persistent login

### Job Management System
- Flexible job creation with multiple recurrence patterns (once, daily, weekly, monthly)
- Status workflow: assigned → in_progress → completed → approved
- Automatic payment processing upon job approval
- Family-scoped job visibility and management

### Financial Allocation Engine
- Automatic splitting of payments based on custom percentages
- Four allocation categories: spending, savings, Roth IRA, brokerage
- Parent-configurable allocation settings per child
- Real-time balance tracking and reporting

### Learning Management System
- Category-based lesson organization (earning, saving, spending, investing, donating)
- Interactive content delivery
- Progress tracking and streak management
- Achievement system for motivation

## Data Flow

1. **Authentication Flow**: User login → JWT generation → Token-based API access
2. **Job Assignment Flow**: Parent creates job → Assigns to child → Child completes → Parent approves → Payment processing
3. **Payment Processing Flow**: Job approval → Calculate allocations → Update child balances → Record transaction
4. **Learning Flow**: Content delivery → Progress tracking → Achievement updates

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: PostgreSQL database connectivity
- **drizzle-orm**: Type-safe database operations
- **@tanstack/react-query**: Server state management
- **@radix-ui/***: Headless UI component primitives
- **bcrypt**: Password hashing
- **jsonwebtoken**: JWT authentication
- **express**: Web application framework

### Development Dependencies
- **vite**: Build tool and development server
- **typescript**: Static type checking
- **tailwindcss**: Utility-first CSS framework
- **drizzle-kit**: Database migration tool

## Deployment Strategy

### Build Process
- **Frontend**: Vite builds optimized static assets to `dist/public`
- **Backend**: esbuild compiles TypeScript server code to `dist/index.js`
- **Database**: Drizzle Kit handles schema migrations

### Production Configuration
- Environment-based configuration using `NODE_ENV`
- Database URL configuration via environment variables
- JWT secret management through environment variables
- Static file serving for production builds

### Development Setup
- Hot module replacement via Vite middleware
- Automatic server restart with tsx
- Database schema synchronization with `drizzle-kit push`

## Changelog
- June 30, 2025. Initial setup

## User Preferences

Preferred communication style: Simple, everyday language.