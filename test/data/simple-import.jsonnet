local fooModule = import "./simple-import.libsonnet";

{
  bar: fooModule,
  baz: fooModule.foo,
  bat: fooModule.bar,
  bag: fooModule.baz.bat,
  field1: fooModule.testField1,
  field2: fooModule.testField2,
  field3: fooModule.testField3,
  field4: fooModule.testField4,
  field5: fooModule.testField5,
  field6: fooModule.testField6,
  field7: fooModule.testField7,
  field8: fooModule.testField8,
  field9: fooModule.testField9,
  field10: fooModule.testField10,
  field11: fooModule.testField11,
  field12: fooModule.testField12,
}