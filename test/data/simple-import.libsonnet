local f = "fakeImport";
{
  // `foo` is a property that has very useful data.
  foo: 99,
  // `bar` is a local, and comments on top of it should not be
  // retrieved.
  local bar = 300,
  baz: {
    // `bat` contains a fancy value, `batVal`.
    bat: "batVal",
  },
  /* This comment should appear over `testField1`. */
  testField1: "foo",
  /* Line 1 of a comment that appears over `testField2`.
   * Line 2 of a comment that appears over `testField2`.
   */
  testField2: "foo",
  /* Not a comment for `testField3`. */
  /* A comment for `testField3`.
   */
  testField3: "foo"
  /* A comment for `testField4`. */
  , testField4: "foo"
  /* Not a comment for `testField5`. */
  ,
  /* A comment for `testField5`. */
  testField5: "foo",
  // Not a comment for `testField6`.
  /* A comment for `testField6`.
   */
   // A comment for `testField6`.
  testField6: "foo",
  # A comment for `testField7`.
  testField7: "foo",
  # Line 1 of a comment for `testField8`.
  # Line 2 of a comment for `testField8`.
  testField8: "foo"
  # A comment for `testField9`.
  , testField9: "foo"
  # Not a comment for `testField10`.
  ,
  # A comment for `testField10`.
  testField10: "foo",
}