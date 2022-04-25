# vendors-unlock-sapui5-frontend
An implementation of workflow for Vendor Unlock Approval process.
Users create Vendor Unlock Requests, which are then approved or rejected by dedicated teams. In case of successful approval, vendors are unlocked and confirmed in Managed System(s) (vendor master data key systems like SAP ERP).

Requested workflow for Vendor Unlock Approval process was implemented in a framework of SAP Solution Manager system IT Service Management functionality. 

SAP Solution Manager system is a core system of Vendor Unlock Approval process: it contains a logic of Vendor Unlock Requests processing and is connected to Managed Systems via RFC connections to get and update vendors master records. 

Users access SAP Solution Manager system applications, related to Vendor Unlock Approval process, published on SAP NetWeaver system.

Vendor Unlock Approval process has three participants: 

- Requestor
- Level 1 approval team
- Level 2 approval team

All vendor unlock approval request details are stored in Vendor Unlock Request object of SAP Solution Manager system IT Service Management functionality. Technically Vendor Unlock Request object of SAP Solution Manager system IT Service Management functionality is an Incident of type ZMIN.

Every Vendor Unlock Request (Incident of type ZMIN) passes three stages: 

1.	Creation of Vendor Unlock Request by Requestor
2.	Approval or rejection of Vendor Unlock Request by Level 1 approval team
3.	Approval or rejection of Vendor Unlock Request by Level 2 approval team
