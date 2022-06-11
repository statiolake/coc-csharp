/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import AbstractSupport from './abstractProvider';
import * as serverUtils from '../omnisharp/utils';
import { createRequest } from '../omnisharp/typeConversion';
import { SignatureHelpProvider, SignatureHelp, ParameterInformation, CancellationToken, TextDocument, Position, MarkupKind, MarkupContent } from 'coc.nvim';
import { SignatureHelpParameter } from '../omnisharp/protocol';

export default class OmniSharpSignatureHelpProvider extends AbstractSupport implements SignatureHelpProvider {

    public async provideSignatureHelp(document: TextDocument, position: Position, token: CancellationToken): Promise<SignatureHelp> {

        let req = createRequest(document, position);

        try {
            let res = await serverUtils.signatureHelp(this._server, req, token);

            if (!res) {
                return undefined;
            }

            const signatures = []
            for (let signature of res.Signatures) {

                const parameters: ParameterInformation[] = []
                for (let parameter of signature.Parameters) {
                    let parameterInfo: ParameterInformation = {
                        label: parameter.Label,
                        documentation: this.GetParameterDocumentation(parameter),
                    };
                    parameters.push(parameterInfo);
                }

                signatures.push({
                    label: signature.Label,
                    documentation: signature.StructuredDocumentation.SummaryText,
                    parameters,
                });
            }

            return {
                activeSignature: res.ActiveSignature,
                activeParameter: res.ActiveParameter,
                signatures,
            };
        }
        catch (error) {
            return undefined;
        }
    }

    private GetParameterDocumentation(parameter: SignatureHelpParameter): string | MarkupContent {
        let summary = parameter.Documentation;
        if (summary.length > 0) {
            let paramText = `**${parameter.Name}**: ${summary}`;
            return {
                kind: MarkupKind.Markdown,
                value: paramText,
            }
        }

        return "";
    }
}
