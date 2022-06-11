/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import OmnisharpReferenceProvider from "../../src/features/referenceProvider";
import * as path from "path";
import testAssetWorkspace from "./testAssets/testAssetWorkspace";
import { expect, should } from "chai";
import { activateCSharpExtension, isRazorWorkspace, isSlnWithGenerator } from './integrationHelpers';

suite(`${OmnisharpReferenceProvider.name}: ${testAssetWorkspace.description}`, () => {
    let fileUri: vscode.Uri;

    suiteSetup(async function () {
        should();

        if (isRazorWorkspace(vscode.workspace) || isSlnWithGenerator(vscode.workspace)) {
            this.skip();
        }

        const activation = await activateCSharpExtension();
        await testAssetWorkspace.restore();

        let fileName = 'reference.cs';
        let projectDirectory = testAssetWorkspace.projects[0].projectDirectoryPath;
        fileUri = vscode.Uri.file(path.join(projectDirectory, fileName));
        await vscode.commands.executeCommand("vscode.open", fileUri);

        await testAssetWorkspace.waitForIdle(activation.eventStream);
    });

    suiteTeardown(async () => {
        await testAssetWorkspace.cleanupWorkspace();
    });

    test("Returns the reference without declaration", async () => {
        let referenceList = <vscode.Location[]>(await vscode.commands.executeCommand("vscode.executeReferenceProvider", fileUri, new vscode.Position(6, 22)));
        expect(referenceList.length).to.be.equal(1);
        expect(referenceList[0].range.start.line).to.be.equal(13);
    });
});
