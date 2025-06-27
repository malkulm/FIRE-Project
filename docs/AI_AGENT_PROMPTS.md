# AI Agent Prompt Templates

This document provides standardized prompt templates for AI agents working on the FIRE Planning repository. Use these templates to ensure consistent development practices and proper documentation.

## 🤖 Quick Start Template

For immediate use when making changes to the repository:

```markdown
You are working on the FIRE Planning repository - a banking data collection service via Powens API optimized for agentic AI development.

CRITICAL FIRST STEPS:
1. Read docs/API_REFERENCE.md for current endpoints
2. Check docs/AGENTIC_DEVELOPMENT.md for development guidelines
3. Review docs/CHANGE_LOG.md for recent changes
4. Examine the target file's imports/exports for dependencies

AFTER MAKING CHANGES:
1. Update relevant documentation in docs/
2. Add entry to docs/CHANGE_LOG.md with timestamp and details
3. Test the functionality if possible

REPOSITORY STRUCTURE:
- src/server.js - Main Express server
- src/routes/ - API endpoints (auth, accounts, transactions, sync)
- src/services/powens/ - Powens API integration
- src/config/database.js - PostgreSQL connection
- src/middleware/ - Express middleware
- src/public/index.html - Testing dashboard

NOW PROCEED WITH: [Your specific request]
```

## 📝 Detailed Templates by Task Type

### 1. New Feature Development

```markdown
## New Feature Development Request

**Repository**: FIRE Planning - Banking Data Collection Service
**Task**: Implement [FEATURE_NAME]

**Pre-Development Analysis Required:**
1. Read docs/API_REFERENCE.md to understand existing endpoints
2. Review docs/AGENTIC_DEVELOPMENT.md for development patterns
3. Check docs/CHANGE_LOG.md for recent modifications
4. Understand database schema implications
5. Consider impact on Powens integration

**Development Requirements:**
1. Follow existing code patterns in src/routes/ and src/services/
2. Add appropriate error handling using src/middleware/errorHandler.js patterns
3. Include input validation using Joi schemas
4. Add logging statements using src/utils/logger.js
5. Update API documentation in docs/API_REFERENCE.md
6. Add tests if applicable

**Mandatory Documentation Updates:**
- docs/API_REFERENCE.md (if adding endpoints)
- docs/CHANGE_LOG.md (required for all changes)
- Inline code comments for complex logic

**Implementation Request:**
[Detailed description of the feature to implement]

**Acceptance Criteria:**
- [ ] Feature works as described
- [ ] Error handling implemented
- [ ] Documentation updated
- [ ] Change log entry added
- [ ] Follows existing patterns
```

### 2. Bug Fix Template

```markdown
## Bug Fix Request

**Repository**: FIRE Planning - Banking Data Collection Service
**Issue**: [BUG_DESCRIPTION]

**Investigation Protocol:**
1. Check docs/CHANGE_LOG.md for recent changes that might be related
2. Review the specific file and its dependencies
3. Examine error logs and patterns
4. Test with minimal frontend at src/public/index.html

**Fix Requirements:**
1. Identify root cause of the issue
2. Implement minimal fix that doesn't break existing functionality
3. Add error handling if missing
4. Update relevant documentation if behavior changes
5. Log the fix in docs/CHANGE_LOG.md

**Fix This Issue:**
[Detailed description of the bug and expected behavior]

**Testing Instructions:**
After fixing, verify:
- [ ] Issue is resolved
- [ ] No regression in other functionality
- [ ] Error handling works appropriately
- [ ] Logs show expected information
```

### 3. API Endpoint Development

```markdown
## API Endpoint Development

**Repository**: FIRE Planning - Banking Data Collection Service
**Endpoint**: [METHOD] /api/[PATH]

**Required Reading:**
1. docs/API_REFERENCE.md - Understand existing API patterns
2. src/routes/ - Review existing route implementations
3. src/middleware/errorHandler.js - Error response format
4. src/utils/logger.js - Logging patterns

**Implementation Checklist:**
- [ ] Create route in appropriate file (auth.js, accounts.js, transactions.js, sync.js)
- [ ] Add input validation using Joi
- [ ] Implement business logic (call services if needed)
- [ ] Add error handling with consistent format
- [ ] Include logging statements
- [ ] Update docs/API_REFERENCE.md
- [ ] Update docs/CHANGE_LOG.md

**Endpoint Specification:**
- Method: [GET/POST/PUT/DELETE]
- Path: /api/[path]
- Purpose: [description]
- Request Body: [if applicable]
- Query Parameters: [if applicable]
- Response Format: [description]

**Implement this endpoint following the patterns in existing route files.**
```

### 4. Database/Model Changes

```markdown
## Database/Model Modification

**Repository**: FIRE Planning - Banking Data Collection Service
**Change Type**: [Schema/Model/Migration]

**CRITICAL - Database Changes Protocol:**
1. Review current database schema understanding
2. Consider impact on existing data
3. Plan migration strategy if needed
4. Update relevant model files in src/models/ (when created)
5. Test with src/config/database.js connection

**Documentation Requirements:**
- Update database documentation (when schema changes)
- Update docs/CHANGE_LOG.md with MAJOR severity level
- Document migration steps if needed

**Change Request:**
[Detailed description of database/model changes needed]

**Implementation Notes:**
- Preserve existing data relationships
- Add appropriate indexes for performance
- Include error handling for database operations
- Use src/config/database.js patterns for queries
```

### 5. Powens Integration Changes

```markdown
## Powens Integration Modification

**Repository**: FIRE Planning - Banking Data Collection Service
**Component**: Powens API Integration

**Required Context:**
1. Review src/services/powens/ directory structure
2. Understand existing authentication patterns
3. Check error handling for API failures
4. Review token management approach

**Integration Requirements:**
- Maintain fallback authentication methods
- Preserve token encryption/decryption
- Add comprehensive error handling
- Include rate limiting considerations
- Log API calls appropriately

**Modification Request:**
[Detailed description of Powens integration changes]

**Testing Considerations:**
- Test with mock data (ENABLE_MOCK_DATA=true)
- Verify error handling scenarios
- Check token refresh mechanisms
- Validate API response parsing
```

### 6. Frontend/Dashboard Updates

```markdown
## Dashboard/Frontend Update

**Repository**: FIRE Planning - Banking Data Collection Service
**Target**: Minimal Testing Dashboard (src/public/index.html)

**Context**: 
The frontend is intentionally minimal for functionality testing only. Focus on usability for debugging and API testing rather than visual design.

**Requirements:**
- Maintain simple, functional design
- Ensure all API endpoints can be tested
- Add clear error messaging
- Keep responsive design for mobile testing
- Use vanilla JavaScript (no frameworks)

**Update Request:**
[Description of dashboard changes needed]

**Testing Focus:**
- All buttons work correctly
- API responses display properly
- Error states are handled
- Mobile responsive layout maintained
```

## 🔧 Repository-Specific Guidelines

### File Modification Protocol

When modifying any file:

```markdown
**Before touching any file:**
1. Examine its imports - what does it depend on?
2. Check what exports it provides - what depends on it?
3. Look for TODO comments indicating pending implementation
4. Check docs/CHANGE_LOG.md for recent changes to this file

**During modification:**
1. Follow existing code patterns in the file
2. Add appropriate logging using logger patterns
3. Handle errors consistently with middleware/errorHandler.js
4. Add comments for complex logic

**After modification:**
1. Update docs/CHANGE_LOG.md with details
2. Check if docs/API_REFERENCE.md needs updates
3. Test with the minimal dashboard if applicable
```

### Environment Setup Reminder

Always include this context:

```markdown
**Development Environment:**
- Node.js + Express server
- PostgreSQL database 
- Mock data available when ENABLE_MOCK_DATA=true
- Minimal testing dashboard at src/public/index.html
- API documentation at /api/docs (when ENABLE_API_DOCS=true)
- Health check at /health
```

## 🎯 Usage Examples

### Example 1: Add New Endpoint

```markdown
You are working on the FIRE Planning repository - a banking data collection service via Powens API optimized for agentic AI development.

CRITICAL FIRST STEPS:
1. Read docs/API_REFERENCE.md for current endpoints
2. Check docs/AGENTIC_DEVELOPMENT.md for development guidelines  
3. Review docs/CHANGE_LOG.md for recent changes
4. Examine src/routes/accounts.js for existing patterns

TASK: Add a new endpoint GET /api/accounts/:id/balance that returns just the current balance for a specific account.

REQUIREMENTS:
- Follow patterns in src/routes/accounts.js
- Use mock data when ENABLE_MOCK_DATA=true
- Add appropriate error handling
- Update docs/API_REFERENCE.md
- Add entry to docs/CHANGE_LOG.md

NOW IMPLEMENT THIS ENDPOINT.
```

### Example 2: Fix Bug

```markdown
You are working on the FIRE Planning repository - a banking data collection service.

CRITICAL FIRST STEPS:
1. Check docs/CHANGE_LOG.md for recent changes
2. Review src/middleware/errorHandler.js for error patterns
3. Examine src/utils/logger.js for logging

BUG REPORT: The /api/sync/status endpoint is returning 500 errors instead of sync status data.

INVESTIGATION REQUIRED:
1. Check src/routes/sync.js for the endpoint implementation
2. Look for error patterns in the code
3. Test with the dashboard at src/public/index.html

FIX THE BUG AND UPDATE DOCUMENTATION.
```

## 💡 Best Practices Reminders

Include these in any prompt:

```markdown
**Quality Standards:**
- Follow existing error handling patterns
- Use structured logging with appropriate levels
- Validate all inputs appropriately
- Return consistent response formats
- Include meaningful error messages

**Documentation Requirements:**
- Update docs/CHANGE_LOG.md (mandatory)
- Update docs/API_REFERENCE.md (if API changes)
- Add inline comments for complex logic
- Keep documentation current and accurate
```

---

## 📚 Quick Reference

**Essential Files to Read First:**
1. `docs/AGENTIC_DEVELOPMENT.md` - Development guidelines
2. `docs/API_REFERENCE.md` - API documentation  
3. `docs/CHANGE_LOG.md` - Recent changes
4. `src/server.js` - Application entry point

**Key Patterns to Follow:**
- Error handling: `src/middleware/errorHandler.js`
- Logging: `src/utils/logger.js`
- Database: `src/config/database.js`
- Routes: Files in `src/routes/`

**Testing Tools:**
- Dashboard: `http://localhost:3000`
- API Docs: `http://localhost:3000/api/docs`
- Health: `http://localhost:3000/health`

Use these templates to ensure consistent, well-documented development with proper change tracking for effective AI agent collaboration.
