import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as tmp from 'tmp';
import * as myExt from '../client/extension';

describe("extension tests", () => {
    describe("ksonnet", () => {
        const dirs = ["/foo/components/ns"];
        const files = ["/foo/app.yaml"];

        describe("isInApp", () => {

            function withTemp(curPath: string, expected: any) {
                tmp.dir((err, rootPath, cleanupCallback) => {
                    for (let d in dirs) {
                        const dirPath = path.join(rootPath, d);
                        fs.mkdirSync(dirPath);
                    }

                    for (let f in files) {
                        const filePath = path.join(rootPath, f);
                        fs.writeFileSync(filePath, '');
                    }

                    const cur = path.join(rootPath, curPath);
                    const got = myExt.ksonnet.isInApp(cur);
                    assert.equal(got, expected);

                    cleanupCallback();
                })
            }

            it("with a file in components is in a ksonnet app", () => {
                withTemp('/foo/components/file.jsonnet', true);
            })

            it("with a file in a component namespace is in a ksonnet app", () => {
                withTemp('/foo/components/ns/file.jsonnet', true);
            })

            it("with a file not under the components hierarchy is not in a ksonnet app", () => {
                withTemp('/foo/ns/file.jsonnet', false);
            })

            it("with a file in the root directory is not a ksonnet app", () => {
                withTemp('/', false);
            })
        })

        describe('rootPath', () => {

            function withTemp(curPath: string, expected: any) {
                tmp.dir((err, rootPath, cleanupCallback) => {
                    for (let d in dirs) {
                        const dirPath = path.join(rootPath, d);
                        fs.mkdirSync(dirPath);
                    }

                    for (let f in files) {
                        const filePath = path.join(rootPath, f);
                        fs.writeFileSync(filePath, '');
                    }

                    const cur = path.join(rootPath, curPath);
                    const got = myExt.ksonnet.rootPath(cur);
                    assert.equal(got, expected);

                    cleanupCallback();
                })
            }

            it("with a file in components is in a ksonnet app", () => {
                withTemp('/foo/components/file.jsonnet', '/foo');
            })

            it("with a file in a component namespace is in a ksonnet app", () => {
                withTemp('/foo/components/ns/file.jsonnet', '/foo');
            })

            it("with a file not under the components hierarchy is not in a ksonnet app", () => {
                withTemp('/foo/ns/file.jsonnet', '');
            })

            it("with a file in the root directory is not a ksonnet app", () => {
                withTemp('/', '');
            })
        })
    })
})
