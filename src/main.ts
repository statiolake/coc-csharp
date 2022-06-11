/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as OmniSharp from './omnisharp/extension';
import * as util from './common';
import * as coc from 'coc.nvim';

import { ActivationFailure, ActiveTextEditorChanged } from './omnisharp/loggingEvents';
import { WarningMessageObserver } from './observers/WarningMessageObserver';
import { CsharpChannelObserver } from './observers/CsharpChannelObserver';
import { CsharpLoggerObserver } from './observers/CsharpLoggerObserver';
import { DotNetChannelObserver } from './observers/DotnetChannelObserver';
import { DotnetLoggerObserver } from './observers/DotnetLoggerObserver';
import { EventStream } from './EventStream';
import { InformationMessageObserver } from './observers/InformationMessageObserver';
import { OmnisharpChannelObserver } from './observers/OmnisharpChannelObserver';
import { OmnisharpDebugModeLoggerObserver } from './observers/OmnisharpDebugModeLoggerObserver';
import { OmnisharpLoggerObserver } from './observers/OmnisharpLoggerObserver';
import { OmnisharpStatusBarObserver } from './observers/OmnisharpStatusBarObserver';
import { PlatformInformation } from './platform';
import { addJSONProviders } from './features/json/jsonContributions';
import { ProjectStatusBarObserver } from './observers/ProjectStatusBarObserver';
import CSharpExtensionExports from './CSharpExtensionExports';
import { vscodeNetworkSettingsProvider } from './NetworkSettings';
import { ErrorMessageObserver } from './observers/ErrorMessageObserver';
import OptionProvider from './observers/OptionProvider';
import DotNetTestChannelObserver from './observers/DotnetTestChannelObserver';
import DotNetTestLoggerObserver from './observers/DotnetTestLoggerObserver';
import { ShowOmniSharpConfigChangePrompt } from './observers/OptionChangeObserver';
import createOptionStream from './observables/CreateOptionStream';
import { CSharpExtensionId } from './constants/CSharpExtensionId';
import { OpenURLObserver } from './observers/OpenURLObserver';
import { RazorLoggerObserver } from './observers/RazorLoggerObserver';
import { AbsolutePathPackage } from './packageManager/AbsolutePathPackage';
import { downloadAndInstallPackages } from './packageManager/downloadAndInstallPackages';
import IInstallDependencies from './packageManager/IInstallDependencies';
import { installRuntimeDependencies } from './InstallRuntimeDependencies';
import { isValidDownload } from './packageManager/isValidDownload';
import { BackgroundWorkStatusBarObserver } from './observers/BackgroundWorkStatusBarObserver';
import { getDotnetPackApi } from './DotnetPack';

export async function activate(context: coc.ExtensionContext): Promise<CSharpExtensionExports> {
    const extension: coc.Extension<CSharpExtensionExports> = coc.extensions.all.find(e => e.id == CSharpExtensionId) as coc.Extension<CSharpExtensionExports>;
    util.setExtensionPath(context.extensionPath);

    const eventStream = new EventStream();
    const optionStream = createOptionStream();
    let optionProvider = new OptionProvider(optionStream);

    let dotnetChannel = coc.window.createOutputChannel('.NET');
    let dotnetChannelObserver = new DotNetChannelObserver(dotnetChannel);
    let dotnetLoggerObserver = new DotnetLoggerObserver(dotnetChannel);
    eventStream.subscribe(dotnetChannelObserver.post);
    eventStream.subscribe(dotnetLoggerObserver.post);

    let dotnetTestChannel = coc.window.createOutputChannel(".NET Test Log");
    let dotnetTestChannelObserver = new DotNetTestChannelObserver(dotnetTestChannel);
    let dotnetTestLoggerObserver = new DotNetTestLoggerObserver(dotnetTestChannel);
    eventStream.subscribe(dotnetTestChannelObserver.post);
    eventStream.subscribe(dotnetTestLoggerObserver.post);

    let csharpChannel = coc.window.createOutputChannel('coc-csharp-vscode');
    let csharpchannelObserver = new CsharpChannelObserver(csharpChannel);
    let csharpLogObserver = new CsharpLoggerObserver(csharpChannel);
    eventStream.subscribe(csharpchannelObserver.post);
    eventStream.subscribe(csharpLogObserver.post);

    let omnisharpChannel = coc.window.createOutputChannel('OmniSharp Log');
    let omnisharpLogObserver = new OmnisharpLoggerObserver(omnisharpChannel);
    let omnisharpChannelObserver = new OmnisharpChannelObserver(omnisharpChannel);
    eventStream.subscribe(omnisharpLogObserver.post);
    eventStream.subscribe(omnisharpChannelObserver.post);

    let warningMessageObserver = new WarningMessageObserver(() => optionProvider.GetLatestOptions().disableMSBuildDiagnosticWarning || false);
    eventStream.subscribe(warningMessageObserver.post);

    let informationMessageObserver = new InformationMessageObserver();
    eventStream.subscribe(informationMessageObserver.post);

    let errorMessageObserver = new ErrorMessageObserver();
    eventStream.subscribe(errorMessageObserver.post);

    let omnisharpStatusBar = coc.window.createStatusBarItem();
    let omnisharpStatusBarObserver = new OmnisharpStatusBarObserver(omnisharpStatusBar);
    eventStream.subscribe(omnisharpStatusBarObserver.post);

    let projectStatusBar = coc.window.createStatusBarItem();
    let projectStatusBarObserver = new ProjectStatusBarObserver(projectStatusBar);
    eventStream.subscribe(projectStatusBarObserver.post);

    let backgroundWorkStatusBar = coc.window.createStatusBarItem();
    let backgroundWorkStatusBarObserver = new BackgroundWorkStatusBarObserver(backgroundWorkStatusBar);
    eventStream.subscribe(backgroundWorkStatusBarObserver.post);

    let openURLObserver = new OpenURLObserver();
    eventStream.subscribe(openURLObserver.post);

    const debugMode = false;
    if (debugMode) {
        let omnisharpDebugModeLoggerObserver = new OmnisharpDebugModeLoggerObserver(omnisharpChannel);
        eventStream.subscribe(omnisharpDebugModeLoggerObserver.post);
    }

    let platformInfo: PlatformInformation;
    try {
        platformInfo = await PlatformInformation.GetCurrent();
    }
    catch (error) {
        eventStream.post(new ActivationFailure());
    }

    if (!isSupportedPlatform(platformInfo)) {
        const platform: string = platformInfo.platform ? platformInfo.platform : "this platform";
        const architecture: string = platformInfo.architecture ? platformInfo.architecture : " and <unknown processor architecture>";
        let errorMessage: string = `The C# extension for Visual Studio Code (powered by OmniSharp) is incompatible on ${platform} ${architecture}`;
        await coc.window.showErrorMessage(errorMessage);

        // Unsupported platform
        return null;
    }

    // If the dotnet bundle is installed, this will ensure the dotnet CLI is on the path.
    await initializeDotnetPath();

    let networkSettingsProvider = vscodeNetworkSettingsProvider();
    const useFramework = optionProvider.GetLatestOptions().useModernNet !== true;
    let installDependencies: IInstallDependencies = async (dependencies: AbsolutePathPackage[]) => downloadAndInstallPackages(dependencies, networkSettingsProvider, eventStream, isValidDownload, useFramework);
    /* let runtimeDependenciesExist = */ await ensureRuntimeDependencies(extension, eventStream, platformInfo, installDependencies, useFramework);

    // activate language services
    let langServicePromise = OmniSharp.activate(context, extension.packageJSON, platformInfo, networkSettingsProvider, eventStream, optionProvider, extension.extensionPath);

    // register JSON completion & hover providers for project.json
    context.subscriptions.push(addJSONProviders());
    context.subscriptions.push(coc.window.onDidChangeActiveTextEditor(() => {
        eventStream.post(new ActiveTextEditorChanged());
    }));

    context.subscriptions.push(optionProvider);
    context.subscriptions.push(ShowOmniSharpConfigChangePrompt(optionStream));

    let razorPromise = Promise.resolve();
    if (!optionProvider.GetLatestOptions().razorDisabled) {
        const razorObserver = new RazorLoggerObserver(omnisharpChannel);
        eventStream.subscribe(razorObserver.post);
    }

    return {
        initializationFinished: async () => {
            let langService = await langServicePromise;
            await langService.server.waitForEmptyEventQueue();
            await razorPromise;
        },
        getAdvisor: async () => {
            let langService = await langServicePromise;
            return langService.advisor;
        },
        getTestManager: async () => {
            let langService = await langServicePromise;
            return langService.testManager;
        },
        eventStream
    };
}

function isSupportedPlatform(platform: PlatformInformation): boolean {
    if (platform.isWindows()) {
        return platform.architecture === "x86" || platform.architecture === "x86_64" || platform.architecture === "arm64";
    }

    if (platform.isMacOS()) {
        return true;
    }

    if (platform.isLinux()) {
        return platform.architecture === "x86_64" ||
            platform.architecture === "x86" ||
            platform.architecture === "i686" ||
            platform.architecture === "arm64";
    }

    return false;
}

async function ensureRuntimeDependencies(extension: coc.Extension<CSharpExtensionExports>, eventStream: EventStream, platformInfo: PlatformInformation, installDependencies: IInstallDependencies, useFramework: boolean): Promise<boolean> {
    return installRuntimeDependencies(extension.packageJSON, extension.extensionPath, installDependencies, eventStream, platformInfo, useFramework);
}

async function initializeDotnetPath() {
    const dotnetPackApi = await getDotnetPackApi();
    if (!dotnetPackApi) {
        return null;
    }
    return await dotnetPackApi.getDotnetPath();
}