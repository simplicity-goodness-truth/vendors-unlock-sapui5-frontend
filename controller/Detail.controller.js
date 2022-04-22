/*global location */
sap.ui.define([
  "ZAPPVNDUNLOCK/controller/BaseController",
  "sap/ui/model/json/JSONModel",
  "ZAPPVNDUNLOCK/model/formatter"
], function(BaseController, JSONModel, formatter) {
  "use strict";

  return BaseController.extend("ZAPPVNDUNLOCK.controller.Detail", {

    formatter: formatter,

    /* =========================================================== */
    /* lifecycle methods                                           */
    /* =========================================================== */

    onInit: function() {
      // Model used to manipulate control states. The chosen values make sure,
      // detail page is busy indication immediately so there is no break in
      // between the busy indication for loading the view's meta data
      var oViewModel = new JSONModel({
        busy: false,
        delay: 0,
        lineItemListTitle: this.getResourceBundle().getText("detailLineItemTableHeading")
      });

      this.getRouter().getRoute("object").attachPatternMatched(this._onObjectMatched, this);

      this.setModel(oViewModel, "detailView");

      this.getOwnerComponent().getModel().metadataLoaded().then(this._onMetadataLoaded.bind(this));

      // Committee Central: array of statuses of files validation
      this.filesValidationMatrix = new Map();

    },

    /* =========================================================== */
    /* event handlers                                              */
    /* =========================================================== */

    /**
     * Event handler when the share by E-Mail button has been clicked
     * @public
     */
    onShareEmailPress: function() {
      var oViewModel = this.getModel("detailView");

      sap.m.URLHelper.triggerEmail(
        null,
        oViewModel.getProperty("/shareSendEmailSubject"),
        oViewModel.getProperty("/shareSendEmailMessage")
      );
    },

    /**
     * Event handler when the share in JAM button has been clicked
     * @public
     */
    onShareInJamPress: function() {
      var oViewModel = this.getModel("detailView"),
        oShareDialog = sap.ui.getCore().createComponent({
          name: "sap.collaboration.components.fiori.sharing.dialog",
          settings: {
            object: {
              id: location.href,
              share: oViewModel.getProperty("/shareOnJamTitle")
            }
          }
        });

      oShareDialog.open();
    },

    /**
     * Updates the item count within the line item table's header
     * @param {object} oEvent an event containing the total number of items in the list
     * @private
     */
    onListUpdateFinished: function(oEvent) {
      var sTitle,
        iTotalItems = oEvent.getParameter("total"),
        oViewModel = this.getModel("detailView");

      // only update the counter if the length is final
      if (this.byId("lineItemsList").getBinding("items").isLengthFinal()) {
        if (iTotalItems) {
          sTitle = this.getResourceBundle().getText("detailLineItemTableHeadingCount", [iTotalItems]);
        } else {
          //Display 'Line Items' instead of 'Line items (0)'
          sTitle = this.getResourceBundle().getText("detailLineItemTableHeading");
        }
        oViewModel.setProperty("/lineItemListTitle", sTitle);
      }

    },

    /* =========================================================== */
    /* begin: internal methods                                     */
    /* =========================================================== */

    /**
     * Binds the view to the object path and expands the aggregated line items.
     * @function
     * @param {sap.ui.base.Event} oEvent pattern match event in route 'object'
     * @private
     */
    _onObjectMatched: function(oEvent) {
      var sObjectId = oEvent.getParameter("arguments").objectId;
      this.getModel().metadataLoaded().then(function() {

        var sObjectPath = this.getModel().createKey("RequestSet", {
          guid: sObjectId
        });
        this._bindView("/" + sObjectPath);

      }.bind(this));

    },

    /**
     * Binds the view to the object path. Makes sure that detail view displays
     * a busy indicator while data for the corresponding element binding is loaded.
     * @function
     * @param {string} sObjectPath path to the object to be bound to the view.
     * @private
     */
    _bindView: function(sObjectPath) {
      // Set busy indicator during view binding
      var oViewModel = this.getModel("detailView"),
        oView = this.getView(),
        oObject = oView.getModel().getObject(sObjectPath);

      var sFlowStage;

      if (oObject.FlowStage) {
        sFlowStage = oObject.FlowStage;
      }

      // If the view was not bound yet its not busy, only if the binding requests data it is set to busy again
      oViewModel.setProperty("/busy", false);

      this.getView().bindElement({
        path: sObjectPath,
        events: {
          change: this._onBindingChange.bind(this),
          dataRequested: function() {
            oViewModel.setProperty("/busy", true);
          },
          dataReceived: function() {
            oViewModel.setProperty("/busy", false);
          }
        }
      });

      var attachmentTable = oView.byId("attachmentsTable");
      var attachmentTableItems = attachmentTable.getItems();

      for (var i = 0; i < attachmentTableItems.length; i++) {

        var attachmentTableItem = attachmentTableItems[i];
        var url = attachmentTableItem.getCells()[0].getProperty('href');
        var protocol = url.substring(0, url.indexOf(':'));

        if (protocol === 'http') {
          var newUrl = url.replace("http", "https");
          attachmentTableItem.getCells()[0].setProperty('href', newUrl);
        }
      }


      // L1: cleaning the selection for all switches when we choose a different order

      if ((sFlowStage) && (sFlowStage === "U")) {

        this.filesValidationMatrix = new Map();

        var commiteeCentralFilesValidatorTable = oView.byId("CommiteeCentralFilesValidator");
        var commiteeCentralFilesValidatorTableItems = commiteeCentralFilesValidatorTable.getItems();

        for (var i = 0; i < commiteeCentralFilesValidatorTableItems.length; i++) {

          var commiteeCentralFilesValidatorTableItem = commiteeCentralFilesValidatorTableItems[i];

          // Switch is located in column 3 (0 is the first one)
          commiteeCentralFilesValidatorTableItem.getCells()[3].setProperty('state', false);

        } // for (var i = 0; i < commiteeCentralFilesValidatorTableItems.length; i++)
      } //  if (sFlowStage === 'U')
    },
    onAttachmentSwitchChange: function(oEvent) {

      var switchBtn = oEvent.getSource();

      var attachment = oEvent.getSource().getParent().getBindingContext();

      this.filesValidationMatrix.set(attachment.getProperty("DocumentNumber"), switchBtn.getState());

    },

    handleLinkPress: function(oEvent) {

      var oContext = oEvent.getSource().getBindingContext();
      var inputUrl = oContext.getProperty().__metadata.media_src;
      var protocol = inputUrl.substring(0, inputUrl.indexOf(':'));
      var outputURL = inputUrl;

      if (protocol === 'http') {
        outputURL = inputUrl.replace("http", "https");
      }

      window.open(outputURL);

    },

    _getfilesValidationStatus: function() {

      // Committee Central: getting statuses of files validation

      var filesValidationMatrixContents = {
        files: []
      };
      var oView = this.getView();

      // Array as a mask to flag all confirmed documents

      var byteArrayString = '';
      var byteArrayInt = 0;
      var byteArrayPointer = 0;

      var commiteeCentralFilesValidatorTable = oView.byId("CommiteeCentralFilesValidator");
      var commiteeCentralFilesValidatorTableItems = commiteeCentralFilesValidatorTable.getItems();

      var byteArray = new Uint8Array(commiteeCentralFilesValidatorTableItems.length);

      byteArray = [];

      for (var i = 0; i < commiteeCentralFilesValidatorTableItems.length; i++) {

        var commiteeCentralFilesValidatorTableItem = commiteeCentralFilesValidatorTableItems[i].getBindingContext();

        if (this.filesValidationMatrix.get(commiteeCentralFilesValidatorTableItem.getProperty('DocumentNumber'))) {

          filesValidationMatrixContents.files.push({
            "DocumentNumber": commiteeCentralFilesValidatorTableItem.getProperty('DocumentNumber'),
            "Validated": this.filesValidationMatrix.get(commiteeCentralFilesValidatorTableItem.getProperty('DocumentNumber'))
          });

          byteArray[byteArrayPointer] = 1;

        } else

        {
          filesValidationMatrixContents.files.push({
            "DocumentNumber": commiteeCentralFilesValidatorTableItem.getProperty('DocumentNumber'),
            "Validated": false
          });

          byteArray[byteArrayPointer] = 0;
        }

        byteArrayPointer = byteArrayPointer + 1;

      } // for (var i = 0; i < commiteeCentralFilesValidatorTableItems.length; i++)

      byteArrayString = byteArray.toString().replace(/,/g, '');

      byteArrayInt = parseInt(byteArrayString, 2);

      // Cleaning the selection before posting
      this.filesValidationMatrix = new Map();

      return byteArrayInt;

      //return JSON.stringify(filesValidationMatrixContents);
    },
    onPressApprove: function(oEvent) {
      //This code was generated by the layout editor.
      var U = oEvent.getSource(),
        b = U.getText(),
        m,
        oView = this.getView(),
        oElementBinding = oView.getElementBinding(),
        sPath = oElementBinding.getPath(),
        oObject = oView.getModel().getObject(sPath),
        sObjectId = oObject.ObjectId,
        sGuid = oObject.guid,
        sFlowStage = oObject.FlowStage,
        t = this;

      m = this.getResourceBundle().getText("approveRequest", sObjectId);

      sap.m.MessageBox.confirm(m, {
        title: b,
        actions: [
          b,
          sap.m.MessageBox.Action.CANCEL
        ],
        onClose: function(s) {

          if (s === b) {

            // Level 1 approval: sending list of files

            if (sFlowStage === 'U') {
              t._requestUpdateStatus('pressApprove', sGuid, sObjectId, t._getfilesValidationStatus());
            };

            // Level 2 approval: sending list of files not performed

            if (sFlowStage === 'Y') {
              t._requestUpdateStatus('pressApprove', sGuid, sObjectId);
            };

          }

        }
      });
    },
    onPressReject: function(oEvent) {
      //This code was generated by the layout editor.

      //This code was generated by the layout editor.
      var U = oEvent.getSource(),
        b = U.getText(),
        c,
        m, oView = this.getView(),
        oElementBinding = oView.getElementBinding(),
        sPath = oElementBinding.getPath(),
        oObject = oView.getModel().getObject(sPath),
        sGuid = oObject.guid,
        sObjectId = oObject.ObjectId,
        t = this;

      m = this.getResourceBundle().getText("rejectRequest", sObjectId);

      sap.m.MessageBox.confirm(m, {
        title: b,
        actions: [
          b,
          sap.m.MessageBox.Action.CANCEL
        ],
        onClose: function(s) {

          if (s === b) {

            // Showing comment dialog

            t.commentText = '';

            t.commentDialog = sap.ui.xmlfragment("ZAPPVNDUNLOCK.view.CommentDialog", t);

            t.getView().addDependent(t.commentDialog);

            t.commentDialog.open();

          }
        }
      });
    },

    closeCommentDialog: function(oEvent) {
      this.commentDialog.destroy(true);
    },

    postComment: function(oEvent) {

      var oView = this.getView(),
        oElementBinding = oView.getElementBinding(),
        sPath = oElementBinding.getPath(),
        oObject = oView.getModel().getObject(sPath),
        sGuid = oObject.guid,
        sObjectId = oObject.ObjectId;

      var commentText = this.commentDialog.getContent()[0].getItems()[0].getContent()[0].getValue();

      // Reject is permitted only if comments are entered

      if (commentText !== '') {
        // closing comments fragment
        this.commentDialog.destroy(true);
        //calling update module
        this._requestUpdateStatus('pressReject', sGuid, sObjectId, this._getfilesValidationStatus(), commentText);
      } else {
        var d = this.getResourceBundle().getText("requestRejectWithoutComments");
        sap.m.MessageBox.information(d);
      }
    },

    _requestUpdateStatus: function(U, sGuid, sObjectId, sFilesList, sCommentText) {
      var t = this;

      var sRequestIdPointer;

      var oPayload = {};

      // Getting current incident values

      var oView = this.getView(),
        oElementBinding = oView.getElementBinding(),
        sPath = oElementBinding.getPath(),
        oObject = oView.getModel().getObject(sPath),
        sRequestor = oObject.Requestor,
        sVendorCode = oObject.VendorCode,
        sRequestorLogin = oObject.RequestorLogin,
        sSystem = oObject.System,
        sCompanyCode = oObject.CompanyCode,
        sCompanyName = oObject.CompanyName,
        sPostingDate = oObject.PostingDate,
        sStatus = oObject.Status,
        sFlowStage = oObject.FlowStage,
        sVendorName = oObject.VendorName;

      var d;

      // Variables for routing to master list

      var _oComponent = this.getOwnerComponent();
      var oList = _oComponent.oListSelector._oList;
      var oListBinding = oList.getBinding("items");

      // var sUser;
      sRequestIdPointer = "/RequestSet(guid'" + sGuid + "')";
      //sUser = sap.ushell.Container.getService("UserInfo").getId();

      oPayload.Requestor = sRequestor;
      oPayload.ObjectId = sObjectId;
      oPayload.VendorCode = sVendorCode;
      oPayload.RequestorLogin = sRequestorLogin;
      oPayload.System = sSystem;
      oPayload.CompanyCode = sCompanyCode;
      oPayload.CompanyName = sCompanyName;
      oPayload.PostingDate = sPostingDate;
      oPayload.Status = sStatus;
      oPayload.VendorName = sVendorName;

      switch (U)

      {
        case 'pressApprove':

          // Level 1 Approval

          if (sFlowStage === 'U') {

            // Setting event on EventBus if L1 approval is triggered and sending ObjectId

            var oEventBus = sap.ui.getCore().getEventBus();
            // 1. ChannelName, 2. EventName, 3. the data
            oEventBus.publish("DetailAction", "onComiteeCentralApproval", {
              ObjectId: sObjectId
            });

            oPayload.FlowStage = 'Y';


            this.getModel().update(sRequestIdPointer, oPayload, {
              urlParameters: {
                Action: "Approve",
                Documents: sFilesList
              },
              success: function(oData, response) {

                // L1 successfull approval

                if (response.headers.zapproval_ok) {

                  var returnedObjectId = response.headers.zapproval_ok.substring(0, response.headers.zapproval_ok.indexOf('|'));
                  var returnedScore = response.headers.zapproval_ok.substring(response.headers.zapproval_ok.indexOf('|') + 1);
                  //returnedScore = returnedScore.replace(/\s/g, '');

                  //d = t.getResourceBundle().getText("requestApproved", response.headers.zapproval_ok);
                  d = t.getResourceBundle().getText("requestApprovedL1", [returnedObjectId, returnedScore]);

                } else {

                  //  // L1 failed approval

                  if (JSON.stringify(response.headers.zapproval_failed)) {

                    d = t.getResourceBundle().getText("requestApproveError", response.headers.zapproval_failed);
                  }

                } // if (response.headers.zapproval_ok)

                // Using formatted text for bold font

                var formattedText = new sap.m.FormattedText("FormattedText", {
                  htmlText: d
                });

                sap.m.MessageBox.information(formattedText);

                // Refreshing master view
                //  oListBinding.refresh(true);

                // Refreshing model
                t.getView().getElementBinding().refresh(true);

              }, // : function(oData, response)

              error: function() {

                  d = t.getResourceBundle().getText("requestApproveTechnicalError", sObjectId);

                  sap.m.MessageBox.information(d);
                } //  error: function()
            }); // this.getModel().update

          } // if (sFlowStage === 'U')

          // End of Level 1 Approval

          // Level 2 Approval

          if (sFlowStage === 'Y') {

            oPayload.FlowStage = 'G';

            this.getModel().update(sRequestIdPointer, oPayload, {
              urlParameters: {
                Action: "Approve",
                Documents: sFilesList
              },
              success: function(oData, response) {

                // L2 successfull approval

                if (response.headers.zapproval_ok) {

                  d = t.getResourceBundle().getText("requestApprovedL2", sObjectId);

                  d = d + '.' + ' ' + t.getResourceBundle().getText("vendorUnlocked", response.headers.zapproval_ok) + '.';

                } else {

                  //  // L2 failed approval

                  if (JSON.stringify(response.headers.zapproval_failed).indexOf('1') > -1) {

                    d = t.getResourceBundle().getText("requestApproveTechnicalError", sObjectId);
                  }

                  if (JSON.stringify(response.headers.zapproval_failed).indexOf('2') > -1) {

                    d = t.getResourceBundle().getText("vendorUnlockFailed");
                  }

                } // if (response.headers.zapproval_ok)

                var formattedText = new sap.m.FormattedText("FormattedText", {
                  htmlText: d
                });

                sap.m.MessageBox.information(formattedText);

                // Refreshing master view
                oListBinding.refresh(true);

                //     sap.m.MessageBox.information(JSON.stringify());

              }, // success

              error: function() {
                  d = t.getResourceBundle().getText("requestApproveTechnicalError", sObjectId);
                  sap.m.MessageBox.information(d);
                } // error
            }); // this.getModel().update

            // End of Level 2  Approval

          } // if (sFlowStage === 'Y')

          break; // case 'pressApprove'

        case 'pressReject':

          // Getting rejection text

          if (sCommentText !== '') {

            oPayload.Comments = sCommentText;
          }

          oPayload.FlowStage = 'G';

          this.getModel().update(sRequestIdPointer, oPayload, {
            urlParameters: {
              Action: "Reject",
              Documents: sFilesList
            },
            success: function(oData, response) {

              if (response.headers.zrejection_ok) {

                d = t.getResourceBundle().getText("requestRejected", response.headers.zrejection_ok);

              } else {

                d = t.getResourceBundle().getText("requestRejectError", response.headers.zrejection_failed);

              } //if (response.headers.zrejection_ok)

              var formattedText = new sap.m.FormattedText("FormattedText", {
                htmlText: d
              });

              sap.m.MessageBox.information(formattedText);

              // Refreshing master view
              oListBinding.refresh(true);

            },
            error: function() {
              d = t.getResourceBundle().getText("requestRejectTechnicalError", sObjectId);
              sap.m.MessageBox.information(d);
            }
          });

          break; // case 'pressReject'
      } // switch (U)

    },
    _onBindingChange: function() {
      var oView = this.getView(),
        oElementBinding = oView.getElementBinding();

      // No data for the binding
      if (!oElementBinding.getBoundContext()) {
        this.getRouter().getTargets().display("detailObjectNotFound");
        // if object could not be found, the selection in the master list
        // does not make sense anymore.
        this.getOwnerComponent().oListSelector.clearMasterListSelection();
        return;
      }

      var sPath = oElementBinding.getPath(),
        oResourceBundle = this.getResourceBundle(),
        oObject = oView.getModel().getObject(sPath),
        sObjectId = oObject.guid,
        sObjectName = oObject.ObjectId,
        oViewModel = this.getModel("detailView");

      this.getOwnerComponent().oListSelector.selectAListItem(sPath);

      oViewModel.setProperty("/saveAsTileTitle", oResourceBundle.getText("shareSaveTileAppTitle", [sObjectName]));
      oViewModel.setProperty("/shareOnJamTitle", sObjectName);
      oViewModel.setProperty("/shareSendEmailSubject",
        oResourceBundle.getText("shareSendEmailObjectSubject", [sObjectId]));
      oViewModel.setProperty("/shareSendEmailMessage",
        oResourceBundle.getText("shareSendEmailObjectMessage", [sObjectName, sObjectId, location.href]));

    },

    _onMetadataLoaded: function() {
      // Store original busy indicator delay for the detail view
      var iOriginalViewBusyDelay = this.getView().getBusyIndicatorDelay(),
        oViewModel = this.getModel("detailView"),
        oLineItemTable = this.byId("lineItemsList"),
        iOriginalLineItemTableBusyDelay = oLineItemTable.getBusyIndicatorDelay();

      // Make sure busy indicator is displayed immediately when
      // detail view is displayed for the first time
      oViewModel.setProperty("/delay", 0);
      oViewModel.setProperty("/lineItemTableDelay", 0);

      oLineItemTable.attachEventOnce("updateFinished", function() {
        // Restore original busy indicator delay for line item table
        oViewModel.setProperty("/lineItemTableDelay", iOriginalLineItemTableBusyDelay);
      });

      // Binding the view will set it to not busy - so the view is always busy if it is not bound
      oViewModel.setProperty("/busy", true);
      // Restore original busy indicator delay for the detail view
      oViewModel.setProperty("/delay", iOriginalViewBusyDelay);
    }

  });

});