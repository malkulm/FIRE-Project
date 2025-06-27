# Agentic Development Guidelines

This document provides comprehensive guidelines for AI agents working on the FIRE Planning repository. Follow these protocols to ensure consistent, reliable, and well-documented development.

## 🤖 Core Principles for AI Agents

### 1. Documentation-First Approach
- **ALWAYS** read existing documentation before making changes
- **MUST** update documentation when modifying functionality
- **REQUIRED** to log all changes in `CHANGE_LOG.md`

### 2. Dependency Awareness
- Check file imports and exports before modifications
- Understand database relationships via `DATABASE_SCHEMA.md`
- Review API contracts in `API_REFERENCE.md`

### 3. Change Tracking
- Every modification must be logged in `docs/CHANGE_LOG.md`
- Include timestamp, files changed, reasoning, and potential impacts
- Tag changes with severity: `MINOR`, `MAJOR`, `BREAKING`

## 📋 Pre-Development Checklist

Before making ANY changes, complete this checklist:

- [ ] Read `docs/API_REFERENCE.md` for current endpoints
- [ ] Review `docs/DATABASE_SCHEMA.md` for data relationships
- [ ] Check `docs/POWENS_INTEGRATION.md` for API patterns
- [ ] Examine `docs/CHANGE_LOG.md` for recent modifications
- [ ] Understand the specific file's dependencies (imports/exports)

## 🛠️ Development Workflows

### Workflow 1: Adding New API Endpoint

```markdown
1. **Analysis Phase**
   - Review existing endpoints in `src/routes/`
   - Check database models in `src/models/`
   - Understand authentication requirements

2. **Implementation Phase**
   - Create route file following existing patterns
   - Add input validation using Joi schemas
   - Implement error handling with consistent format
   - Add logging statements for debugging

3. **Documentation Phase**
   - Update `docs/API_REFERENCE.md` with new endpoint
   - Add request/response examples
   - Update `docs/CHANGE_LOG.md`

4. **Testing Phase**
   - Add tests to appropriate test file
   - Test manually via minimal frontend
   - Verify database operations
```

### Workflow 2: Modifying Database Schema

```markdown
1. **Analysis Phase**
   - Review `docs/DATABASE_SCHEMA.md` for current structure
   - Identify all affected models in `src/models/`
   - Check for foreign key relationships

2. **Implementation Phase**
   - Create migration file in `src/migrations/`
   - Update affected model files
   - Modify any related services

3. **Documentation Phase**
   - Update `docs/DATABASE_SCHEMA.md`
   - Document migration process
   - Update `docs/CHANGE_LOG.md` with MAJOR tag

4. **Validation Phase**
   - Test migration rollback capability
   - Verify all relationships still work
   - Update any affected API endpoints
```

### Workflow 3: Powens Integration Changes

```markdown
1. **Analysis Phase**
   - Review `docs/POWENS_INTEGRATION.md`
   - Check current service files in `src/services/powens/`
   - Understand token management flow

2. **Implementation Phase**
   - Follow existing error handling patterns
   - Maintain fallback authentication methods
   - Preserve token encryption/decryption

3. **Documentation Phase**
   - Update `docs/POWENS_INTEGRATION.md`
   - Document any new API calls or methods
   - Update `docs/CHANGE_LOG.md`

4. **Testing Phase**
   - Test with mock data if no API keys
   - Verify error handling scenarios
   - Check token refresh mechanisms
```

## 📝 Code Modification Protocols

### File Modification Template

When modifying any file, use this mental template:

```javascript
// 1. ANALYZE: What does this file do?
// 2. DEPENDENCIES: What imports does it have?
// 3. EXPORTS: What does it provide to other files?
// 4. IMPACT: What other files might be affected?
// 5. TESTING: How can changes be verified?

// Your changes here...

// 6. LOGGING: Add appropriate log statements
// 7. ERROR HANDLING: Follow existing patterns
// 8. DOCUMENTATION: Update inline comments
```

### Consistent Error Handling

Always use this error response format:

```javascript
{
  success: false,
  error: {
    code: 'ERROR_CODE',
    message: 'Human readable message',
    details: 'Technical details for debugging'
  },
  timestamp: new Date().toISOString(),
  requestId: 'unique-request-id'
}
```

### Logging Standards

Use structured logging:

```javascript
logger.info('Operation description', {
  operation: 'operation_name',
  userId: userId,
  accountId: accountId,
  duration: processingTime,
  success: true
});
```

## 🔄 Change Documentation Requirements

### CHANGE_LOG.md Entry Format

```markdown
## [YYYY-MM-DD HH:MM:SS] - SEVERITY_LEVEL

**Modified Files:**
- `path/to/file1.js` - Description of changes
- `path/to/file2.js` - Description of changes

**Change Description:**
Brief description of what was changed and why.

**Reasoning:**
Detailed explanation of the business/technical reason.

**Potential Impacts:**
- API: List any endpoint changes
- Database: List any schema changes
- Dependencies: List any new dependencies
- Configuration: List any env var changes

**Testing Notes:**
How to verify the changes work correctly.

**Agent:** Claude-4-Sonnet
**Request ID:** [if applicable]

---
```

### Severity Levels

- **MINOR**: Bug fixes, documentation updates, minor improvements
- **MAJOR**: New features, significant refactoring, dependency updates
- **BREAKING**: API changes, database schema changes, configuration changes

## 🧪 Testing Requirements

### Manual Testing Checklist

After any changes:

- [ ] Server starts without errors
- [ ] Database connections work
- [ ] Modified endpoints respond correctly
- [ ] Error cases are handled appropriately
- [ ] Logs show expected information

### Automated Testing

- Add unit tests for new functions
- Add integration tests for new endpoints
- Update existing tests if behavior changed
- Ensure all tests pass before completion

## 🚨 Error Recovery Protocols

### If Something Breaks

1. **Immediate Response**
   - Check recent entries in `docs/CHANGE_LOG.md`
   - Identify the last working state
   - Revert problematic changes if necessary

2. **Investigation**
   - Check application logs
   - Verify database state
   - Test API endpoints manually

3. **Resolution**
   - Fix the issue following development workflows
   - Add additional error handling if needed
   - Update documentation with lessons learned

## 📚 Required Reading List

Before making significant changes, ensure familiarity with:

1. `docs/API_REFERENCE.md` - Complete API documentation
2. `docs/DATABASE_SCHEMA.md` - Database structure and relationships
3. `docs/POWENS_INTEGRATION.md` - Powens API integration details
4. `src/config/database.js` - Database configuration
5. `src/utils/logger.js` - Logging utilities
6. `src/middleware/` - Express middleware implementations

## 🎯 Quality Standards

### Code Quality

- Follow existing code patterns and conventions
- Use meaningful variable and function names
- Add comments for complex logic
- Handle errors appropriately
- Include input validation

### Documentation Quality

- Write clear, concise explanations
- Include examples where helpful
- Keep documentation up-to-date
- Use consistent formatting
- Cross-reference related sections

### API Quality

- Consistent response formats
- Appropriate HTTP status codes
- Input validation on all endpoints
- Comprehensive error messages
- Rate limiting where appropriate

## 🔒 Security Considerations

### Data Protection

- Never log sensitive data (tokens, passwords)
- Encrypt sensitive data before database storage
- Validate all input parameters
- Use parameterized queries for database operations
- Implement appropriate rate limiting

### API Security

- Validate JWT tokens where required
- Implement CORS appropriately
- Use HTTPS in production
- Sanitize all user inputs
- Follow principle of least privilege

---

## Quick Reference Commands

```bash
# Start development server
npm run dev

# Run database migrations
npm run migrate

# Run tests
npm test

# Check logs
tail -f logs/app.log

# View API documentation
curl http://localhost:3000/api/docs
```

---

This document should be your primary guide when working on the FIRE Planning repository. Always prioritize documentation, testing, and consistent patterns to maintain code quality and enable effective collaboration with other AI agents.
