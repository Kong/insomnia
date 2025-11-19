import { WorkspacePage } from "../pages/workspace-page"
import { RequestBuilderPage } from "../pages/request-builder-page"
import { Component } from "../pages/component"

export class RequestBuilderWf extends Component {
    private workspacePage = new WorkspacePage(this.page)
    private requestBuilderPage = new RequestBuilderPage(this.page)

    // locators 
    
    // workflows
    async addGetRequest(name: string, requestJson): Promise<void> {
        await this.workspacePage.addRequest()
        if (!!name) {
            // await this.requestBuilderPage.renameRequest(name)
        }
        if ("url" in requestJson) {
            await this.requestBuilderPage.fillUrl(requestJson["url"])
        }
        if ("queryParameters" in requestJson) {
            for (const item of requestJson["queryParameters"]) {
                await this.requestBuilderPage.addQueryParameter(item[0], item[1])
            }  
        }
        if ("preScripts" in requestJson) {
            await this.requestBuilderPage.addPreScript(requestJson["preScripts"])
        }

    }

    async addPostRequest(): Promise<void> {
        
    }

    // assertions
    async checkResponse(status, body="", previewBody=""): Promise<void> {
        await this.requestBuilderPage.checkResponseStatus(status)
        if (!!body) await this.requestBuilderPage.checkResponseBody(body)
        if (!!previewBody) await this.requestBuilderPage.checkResponseRawData(previewBody)
    }
    
}
