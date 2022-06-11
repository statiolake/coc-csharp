/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as protocol from '../omnisharp/protocol';
import * as serverUtils from "../omnisharp/utils";
import * as coc from 'coc.nvim';
import AbstractProvider from './abstractProvider';
import { OmniSharpServer } from '../omnisharp/server';
import { TestExecutionCountReport, ReportDotNetTestResults, DotNetTestRunStart, DotNetTestMessage, DotNetTestRunFailure, DotNetTestsInClassRunStart } from '../omnisharp/loggingEvents';
import { EventStream } from '../EventStream';
import Disposable from '../Disposable';
import CompositeDisposable from '../CompositeDisposable';
import { LanguageMiddlewareFeature } from '../omnisharp/LanguageMiddlewareFeature';
import OptionProvider from '../observers/OptionProvider';

const TelemetryReportingDelay = 2 * 60 * 1000; // two minutes

export default class TestManager extends AbstractProvider {

    private _runCounts: { [testFrameworkName: string]: number };
    private _debugCounts: { [testFrameworkName: string]: number };
    private _telemetryIntervalId: NodeJS.Timer = undefined;
    private _eventStream: EventStream;

    constructor(private optionProvider: OptionProvider, server: OmniSharpServer, eventStream: EventStream, languageMiddlewareFeature: LanguageMiddlewareFeature) {
        super(server, languageMiddlewareFeature);
        this._eventStream = eventStream;

        // register commands
        let d1 = coc.commands.registerCommand(
            'dotnet.test.run',
            async (testMethod, fileName, testFrameworkName) => this.runDotnetTest(testMethod, fileName, testFrameworkName));

        let d4 = coc.commands.registerCommand(
            'dotnet.classTests.run',
            async (className, methodsInClass, fileName, testFrameworkName) => this.runDotnetTestsInClass(className, methodsInClass, fileName, testFrameworkName));

        this._telemetryIntervalId = setInterval(() =>
            this._reportTelemetry(), TelemetryReportingDelay);

        let d3 = new Disposable(() => {
            if (this._telemetryIntervalId !== undefined) {
                // Stop reporting telemetry
                clearInterval(this._telemetryIntervalId);
                this._telemetryIntervalId = undefined;
                this._reportTelemetry();
            }
        });

        this.addDisposables(new CompositeDisposable(d1, d3, d4));
    }

    private _recordRunRequest(testFrameworkName?: string): void {
        if (this._runCounts === undefined) {
            this._runCounts = {};
        }

        if (testFrameworkName === undefined) {
            testFrameworkName = 'context';
        }

        let count = this._runCounts[testFrameworkName];

        if (!count) {
            count = 1;
        }
        else {
            count += 1;
        }

        this._runCounts[testFrameworkName] = count;
    }

    private _reportTelemetry(): void {
        this._eventStream.post(new TestExecutionCountReport(this._debugCounts, this._runCounts));
        this._runCounts = undefined;
        this._debugCounts = undefined;
    }

    private async _runTest(fileName: string, testMethod: string, runSettings: string, testFrameworkName: string, targetFrameworkVersion: string, noBuild: boolean): Promise<protocol.V2.DotNetTestResult[]> {
        const request: protocol.V2.RunTestRequest = {
            FileName: fileName,
            MethodName: testMethod,
            RunSettings: runSettings,
            TestFrameworkName: testFrameworkName,
            TargetFrameworkVersion: targetFrameworkVersion,
            NoBuild: noBuild
        };

        try {
            let response = await serverUtils.runTest(this._server, request);
            return response.Results;
        }
        catch (error) {
            return undefined;
        }
    }

    private async _recordRunAndGetFrameworkVersion(fileName: string, testFrameworkName?: string): Promise<string> {

        this._recordRunRequest(testFrameworkName);
        let projectInfo: protocol.ProjectInformationResponse;
        try {
            projectInfo = await serverUtils.requestProjectInformation(this._server, { FileName: fileName });
        }
        catch (error) {
            return undefined;
        }

        let targetFrameworkVersion: string;

        if (projectInfo.MsBuildProject) {
            targetFrameworkVersion = projectInfo.MsBuildProject.TargetFramework;
        }
        else {
            throw new Error('Expected project.json or .csproj project.');
        }

        return targetFrameworkVersion;
    }

    public async discoverTests(fileName: string, testFrameworkName: string, noBuild: boolean): Promise<protocol.V2.TestInfo[]> {

        let targetFrameworkVersion = await this._recordRunAndGetFrameworkVersion(fileName, testFrameworkName);
        let runSettings = this._getRunSettings(fileName);

        const request: protocol.V2.DiscoverTestsRequest = {
            FileName: fileName,
            RunSettings: runSettings,
            TestFrameworkName: testFrameworkName,
            TargetFrameworkVersion: targetFrameworkVersion,
            NoBuild: noBuild
        };

        try {
            let response = await serverUtils.discoverTests(this._server, request);
            return response.Tests;
        }
        catch (error) {
            return undefined;
        }
    }

    private _getRunSettings(filename: string): string | undefined {
        const testSettingsPath = this.optionProvider.GetLatestOptions().testRunSettings;
        if (testSettingsPath.length === 0) {
            return undefined;
        }

        if (path.isAbsolute(testSettingsPath)) {
            return testSettingsPath;
        }

        // Path is relative to the workspace. Create absolute path.
        const fileUri = coc.Uri.file(filename);
        const workspaceFolder = coc.workspace.getWorkspaceFolder(fileUri.toString());

        return path.join(coc.Uri.parse(workspaceFolder.uri).fsPath, testSettingsPath);
    }

    public async runDotnetTest(testMethod: string, fileName: string, testFrameworkName: string, noBuild: boolean = false) {

        this._eventStream.post(new DotNetTestRunStart(testMethod));

        const listener = this._server.onTestMessage(e => {
            this._eventStream.post(new DotNetTestMessage(e.Message));
        });

        let targetFrameworkVersion = await this._recordRunAndGetFrameworkVersion(fileName, testFrameworkName);
        let runSettings = this._getRunSettings(fileName);

        try {
            let results = await this._runTest(fileName, testMethod, runSettings, testFrameworkName, targetFrameworkVersion, noBuild);
            this._eventStream.post(new ReportDotNetTestResults(results));
        }
        catch (reason) {
            this._eventStream.post(new DotNetTestRunFailure(reason));
        }
        finally {
            listener.dispose();
        }
    }

    public async runDotnetTestsInClass(className: string, methodsInClass: string[], fileName: string, testFrameworkName: string, noBuild: boolean = false) {

        //to do: try to get the class name here
        this._eventStream.post(new DotNetTestsInClassRunStart(className));

        const listener = this._server.onTestMessage(e => {
            this._eventStream.post(new DotNetTestMessage(e.Message));
        });

        let targetFrameworkVersion = await this._recordRunAndGetFrameworkVersion(fileName, testFrameworkName);
        let runSettings = this._getRunSettings(fileName);

        try {
            let results = await this._runTestsInClass(fileName, runSettings, testFrameworkName, targetFrameworkVersion, methodsInClass, noBuild);
            this._eventStream.post(new ReportDotNetTestResults(results));
        }
        catch (reason) {
            this._eventStream.post(new DotNetTestRunFailure(reason));
        }
        finally {
            listener.dispose();
        }
    }

    private async _runTestsInClass(fileName: string, runSettings: string, testFrameworkName: string, targetFrameworkVersion: string, methodsToRun: string[], noBuild: boolean): Promise<protocol.V2.DotNetTestResult[]> {
        const request: protocol.V2.RunTestsInClassRequest = {
            FileName: fileName,
            RunSettings: runSettings,
            TestFrameworkName: testFrameworkName,
            TargetFrameworkVersion: targetFrameworkVersion,
            MethodNames: methodsToRun,
            NoBuild: noBuild
        };

        let response = await serverUtils.runTestsInClass(this._server, request);
        return response.Results;
    }
}
