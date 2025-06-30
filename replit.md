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

### Docker Self-Hosting
- **Multi-stage Dockerfile**: Optimized production builds with security best practices
- **Docker Compose**: Complete stack deployment with PostgreSQL and optional Nginx
- **Database Initialization**: Automated schema creation and demo data seeding
- **SSL Support**: Self-signed certificates for HTTPS deployment
- **Health Checks**: Built-in monitoring for application and database containers
- **Volume Management**: Persistent data storage for database and application logs

### Build Process
- **Frontend**: Vite builds optimized static assets to `dist/public`
- **Backend**: esbuild compiles TypeScript server code to `dist/index.js`
- **Database**: PostgreSQL with automated migration support
- **Containerization**: Production-ready Docker images with security hardening

### Production Configuration
- Environment-based configuration using `NODE_ENV`
- PostgreSQL database with connection pooling
- JWT secret management through environment variables
- CORS and security headers configuration
- Rate limiting and DDoS protection via Nginx
- SSL/TLS termination with certificate management

### Development Setup
- Hot module replacement via Vite middleware
- Automatic server restart with tsx
- In-memory storage for rapid development
- Database schema synchronization with `drizzle-kit push`

### Self-Hosting Features
- **Quick Start**: Single command deployment with `docker-compose up -d`
- **Production Ready**: HTTPS, rate limiting, security headers, and monitoring
- **Scalable**: Support for multiple application instances and load balancing
- **Backup Support**: Database backup and restore capabilities
- **Custom Domains**: Easy configuration for production domains
- **Resource Management**: Configurable memory and CPU limits

## Changelog
- June 30, 2025: Initial setup
- June 30, 2025: Added complete Docker self-hosting solution with PostgreSQL, Nginx, SSL support, and comprehensive deployment documentation
- June 30, 2025: Integrated PostgreSQL database with automatic initialization, connection retry logic for containers, and hybrid storage system (PostgreSQL for production, in-memory for development)
- June 30, 2025: Fixed authentication system with immediate login redirect - users are now automatically taken to dashboard after successful login, resolving UI state update issues
- June 30, 2025: Added comprehensive job icon selection system with 40+ categorized icons and scrollable interfaces for both icon selector and job creation form
- June 30, 2025: Fixed user name display bug - dashboard now correctly shows logged-in user's name instead of defaulting to child name
- June 30, 2025: Implemented role-based dashboard content - parents see family management tools and overview stats while children see personal progress and achievements
- June 30, 2025: Completed configurable investment account types system - parents can now enable/disable specific account types (Spending, Savings, Roth IRA, Brokerage) through a dedicated configuration interface, with payment allocation modal dynamically showing only enabled accounts

## User Preferences

Preferred communication style: Simple, everyday language.