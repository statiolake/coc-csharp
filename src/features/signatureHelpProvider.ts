/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import AbstractSupport from './abstractProvider';
import * as serverUtils from '../omnisharp/utils';
import { createRequest } from '../omnisharp/typeConversion';
import { SignatureHelpProvider, SignatureHelp, SignatureInformation, ParameterInformation, CancellationToken, TextDocument, Position, MarkupContent, MarkupKind } from 'coc.nvim';
import { SignatureHelpParameter } from '../omnisharp/protocol';

export default class OmniSharpSignatureHelpProvider extends AbstractSupport implements SignatureHelpProvider {

    public async provideSignatureHelp(document: TextDocument, position: Position, token: CancellationToken): Promise<SignatureHelp> {

        let req = createRequest(document, position);

        try {
            let res = await serverUtils.signatureHelp(this._server, req, token);

            if (!res) {
                return undefined;
            }

            let ret: SignatureHelp = {
                activeSignature: res.ActiveSignature,
                activeParameter: res.ActiveParameter,
                signatures: []
            };
            for (let signature of res.Signatures) {
                let signatureInfo: SignatureInformation = {
                    label: signature.Label,
                    documentation: signature.StructuredDocumentation.SummaryText,
                };
                ret.signatures.push(signatureInfo);

                for (let parameter of signature.Parameters) {
                    let parameterInfo: ParameterInformation = {
                        label: parameter.Label,
                        documentation: this.GetParameterDocumentation(parameter),
                    };
                    signatureInfo.parameters.push(parameterInfo);
                }
            }



            return ret;
        }
        catch (error) {
            return undefined;
        }
    }

    private GetParameterDocumentation(parameter: SignatureHelpParameter): MarkupContent {
        let summary = parameter.Documentation;
        if (summary.length > 0) {
            let paramText = `**${parameter.Name}**: ${summary}`;
            return {
                kind: MarkupKind.Markdown,
                value: paramText,
            };
        }

        return {
            kind: MarkupKind.PlainText,
            value: "",
        };
    }
}
