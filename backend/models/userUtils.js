/**
 * User Utilities
 * Helper functions for user-related operations
 */

/**
 * Builds a full name from individual name parts
 * @param {string} firstName - First name
 * @param {string} secondName - Second name (optional)
 * @param {string} thirdName - Third name (optional)
 * @param {string} lastName - Last name
 * @returns {string} Full name
 */
function buildFullName(firstName, secondName, thirdName, lastName) {
  const nameParts = [firstName, secondName, thirdName, lastName].filter(part => part && part.trim());
  return nameParts.join(' ');
}

/**
 * SQL CONCAT expression for building full name from database fields
 * @returns {string} SQL CONCAT expression
 */
function getFullNameSQL() {
  return `CONCAT(
    COALESCE(first_name, ''),
    CASE WHEN second_name IS NOT NULL AND second_name != '' THEN CONCAT(' ', second_name) ELSE '' END,
    CASE WHEN third_name IS NOT NULL AND third_name != '' THEN CONCAT(' ', third_name) ELSE '' END,
    CASE WHEN last_name IS NOT NULL AND last_name != '' THEN CONCAT(' ', last_name) ELSE '' END
  )`;
}

/**
 * SQL CONCAT expression for building full name with table alias
 * @param {string} tableAlias - Table alias (e.g., 'u', 'u1', 'u2')
 * @returns {string} SQL CONCAT expression with table alias
 */
function getFullNameSQLWithAlias(tableAlias) {
  return `CONCAT(
    COALESCE(${tableAlias}.first_name, ''),
    CASE WHEN ${tableAlias}.second_name IS NOT NULL AND ${tableAlias}.second_name != '' THEN CONCAT(' ', ${tableAlias}.second_name) ELSE '' END,
    CASE WHEN ${tableAlias}.third_name IS NOT NULL AND ${tableAlias}.third_name != '' THEN CONCAT(' ', ${tableAlias}.third_name) ELSE '' END,
    CASE WHEN ${tableAlias}.last_name IS NOT NULL AND ${tableAlias}.last_name != '' THEN CONCAT(' ', ${tableAlias}.last_name) ELSE '' END
  )`;
}

/**
 * SQL CONCAT expression for building full name with fallback to username
 * @returns {string} SQL CONCAT expression with username fallback
 */
function getFullNameSQLWithFallback() {
  return `COALESCE(
    NULLIF(TRIM(CONCAT(
      COALESCE(first_name, ''),
      CASE WHEN second_name IS NOT NULL AND second_name != '' THEN CONCAT(' ', second_name) ELSE '' END,
      CASE WHEN third_name IS NOT NULL AND third_name != '' THEN CONCAT(' ', third_name) ELSE '' END,
      CASE WHEN last_name IS NOT NULL AND last_name != '' THEN CONCAT(' ', last_name) ELSE '' END
    )), ''),
    username
  )`;
}

/**
 * SQL CONCAT expression for building full name with table alias and fallback to username
 * @param {string} tableAlias - Table alias (e.g., 'u', 'u1', 'u2')
 * @returns {string} SQL CONCAT expression with table alias and username fallback
 */
function getFullNameSQLWithAliasAndFallback(tableAlias) {
  return `COALESCE(
    NULLIF(TRIM(CONCAT(
      COALESCE(${tableAlias}.first_name, ''),
      CASE WHEN ${tableAlias}.second_name IS NOT NULL AND ${tableAlias}.second_name != '' THEN CONCAT(' ', ${tableAlias}.second_name) ELSE '' END,
      CASE WHEN ${tableAlias}.third_name IS NOT NULL AND ${tableAlias}.third_name != '' THEN CONCAT(' ', ${tableAlias}.third_name) ELSE '' END,
      CASE WHEN ${tableAlias}.last_name IS NOT NULL AND ${tableAlias}.last_name != '' THEN CONCAT(' ', ${tableAlias}.last_name) ELSE '' END
    )), ''),
    ${tableAlias}.username
  )`;
}

module.exports = {
  buildFullName,
  getFullNameSQL,
  getFullNameSQLWithAlias,
  getFullNameSQLWithFallback,
  getFullNameSQLWithAliasAndFallback
}; 