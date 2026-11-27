/* validate any k8s name
 *  if enclosed in quotes, switch to exact match
 *  else:
 *    allow upper / lower case alphanumeric (case ignored) and '.' (for nodes)
 *    allow '*'
 *    don't force to start / end with alphanumeric since we can filter on partial names
 */
const k8sName = RegExp('^[-a-zA-Z0-9.*]*$');
const strictK8sName = RegExp('^[a-z0-9]([-a-z0-9.]*[a-z0-9])?$');

// validate regex and ensure we don't have quotes or only two
export const validateK8SName = (name: string) => {
  if (name.charAt(0) === '"' && name.charAt(name.length - 1) === '"') {
    return validateStrictK8SName(name.substring(1, name.length - 1));
  }
  return k8sName.test(name);
};

// validate strict regex
export const validateStrictK8SName = (name: string) => {
  return strictK8sName.test(name);
};
