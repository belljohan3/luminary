import { DbService, DbQueryResult } from "./db.service";
import { randomUUID } from "crypto";
import { DocType, Uuid } from "../enums";
import { createTestingModule } from "../test/testingModule";

describe("DbService", () => {
    let service: DbService;

    beforeAll(async () => {
        service = (await createTestingModule("db-service")).dbService;
    });

    // =================== general ===================

    it("can be instantiated", () => {
        expect(service).toBeDefined();
    });

    it("can read a single existing document", async () => {
        const res: any = await service.getDoc("user-public");

        expect(res.docs[0]._id).toBe("user-public");
    });

    it("can handle exceptions on reading non-exising documents", async () => {
        const res: any = await service.getDoc("non-existing-document");

        expect(res.docs.length).toBe(0);
    });

    // =================== general ===================

    // =================== upsertDoc ===================

    it("can insert a new document and return the full document in the result's 'changes' field", async () => {
        const uuid = randomUUID();
        const doc = {
            _id: uuid,
            testData: "test123",
        };

        const res = await service.upsertDoc(doc);

        const testGet = (await service.getDoc(uuid)) as any;

        expect(testGet.docs[0]._id).toBe(uuid);
        expect(testGet.docs[0].testData).toBe("test123");
        expect(res.changes.testData).toBe("test123");
        expect(res.changes._id).toBe(uuid);
    });

    it("can calculate a document diff and return the diff with the upsert result", async () => {
        const doc1 = {
            _id: "diffTest",
            testData: "test123",
            unchangedData: "test123",
        };
        const doc2 = {
            _id: "diffTest",
            testData: "changedData123",
            unchangedData: "test123",
        };

        await service.upsertDoc(doc1);
        const res = await service.upsertDoc(doc2);

        expect(res.changes.testData).toBe("changedData123");
        expect(res.changes._id).toBe("diffTest");
        expect(res.changes.unchangedData).toBe(undefined);
    });

    it("cannot insert a new document without an id", async () => {
        const doc = {
            testData: "test123",
        };

        await expect(service.upsertDoc(doc)).rejects.toBe(
            "Invalid document: The passed document does not have an '_id' property",
        );
    });

    it("can update an existing document", async () => {
        const uuid = randomUUID();

        // Insert a document
        const originalDoc = {
            _id: uuid,
            testData: "test123",
        };
        await service.upsertDoc(originalDoc);

        // Update the document
        const changedDoc = {
            _id: uuid,
            testData: "changedData123",
        };
        await service.upsertDoc(changedDoc);

        const testGet = (await service.getDoc(uuid)) as any;

        expect(testGet.docs[0]._id).toBe(uuid);
        expect(testGet.docs[0].testData).toBe("changedData123");
    });

    it("will only update a document if the document has changed, ignoring _rev and undefined fields", async () => {
        const uuid = randomUUID();

        // Insert a document
        const originalDoc = {
            _id: uuid,
            testData: "test123",
        };
        await service.upsertDoc(originalDoc);

        // Add a _rev property and some empty fields to the document
        const changedDoc = {
            _id: uuid,
            testData: "test123",
            _rev: "123",
            test: undefined,
            test2: null,
        };

        // Update the document with the same data
        const res = await service.upsertDoc(changedDoc);

        expect(res.message).toBe("Document is identical to the one in the database");
    });

    it("can get the latest document updated time", async () => {
        // Add / update a document and check if the latest document update time is close to now.
        const doc = {
            _id: "docUpdateTimeTest",
            testData: "newData123",
        };
        await service.upsertDoc(doc);
        const newDoc = (await service.getDoc(doc._id)).docs[0];

        const res: number = await service.getLatestDocUpdatedTime();

        expect(res).toBe(newDoc.updatedTimeUtc);
    });

    it("can detect that a document is exactly the same as the document in the database", async () => {
        const doc = {
            _id: "docIdenticalTest",
            testData: "test123",
        };
        await service.upsertDoc(doc);
        const res: any = await service.upsertDoc(doc);
        expect(res.message).toBe("Document is identical to the one in the database");
    });

    it("can handle simultaneous updates to a single existing document", async () => {
        // Insert a document into the database to ensure there is an existing document
        await service.upsertDoc({ _id: "simultaneousTest", testVal: 0 });

        // Generate changes to the document and submit them in parallel
        const pList = new Array<Promise<any>>();

        for (let index = 1; index <= 50; index++) {
            pList.push(service.upsertDoc({ _id: "simultaneousTest", testVal: index }));
        }

        let res: boolean = false;
        await Promise.all(pList);

        // if we got past this point without an exception, the test was successful
        res = true;
        expect(res).toBe(true);
    }, 10000);

    // =================== upsertDoc ===================

    // =================== getGroups ===================

    it("can get all groups", async () => {
        const res: any = await service.getGroups();

        const docCount = res.docs.length;
        expect(docCount).toBe(8);
    });

    // =================== getGroups ===================

    it("can get a list of documents filtered by document ID and document type", async () => {
        // Test if we can return two documents with the passed IDs and valid document types
        const res: any = await service.getDocs(
            ["lang-eng", "user-public"],
            [DocType.Language, DocType.User],
        );

        expect(res.docs.length).toBe(2);
        expect(res.docs.some((d) => d._id === "lang-eng")).toBe(true);
        expect(res.docs.some((d) => d._id === "user-public")).toBe(true);

        // Test if we can return one document with a correct document type, while the other document is discarded due to an incorrect document type
        const res2: any = await service.getDocs(
            ["lang-eng", "user-public"],
            [DocType.Language, DocType.Group],
        );

        expect(res2.docs.length).toBe(1);
        expect(res2.docs.some((d) => d._id === "lang-eng")).toBe(true);
        expect(res2.docs.some((d) => d._id === "user-public")).toBe(false);
    });

    it("can get content documents by their parent ID", async () => {
        const res: any = await service.getContentByParentId("post-blog1");

        expect(res.docs.length).toBe(2);
        expect(res.docs.some((d) => d._id == "content-blog1-eng")).toBe(true);
        expect(res.docs.some((d) => d._id == "content-blog1-fra")).toBe(true);
    });

    it("does not return indexing warnings on getGroups queries", async () => {
        const res: DbQueryResult = await service.getGroups();
        expect(res.warnings).toBe(undefined);
    });

    it("emits two 'update' events when a document is added or updated", async () => {
        const doc = {
            _id: "post-post1",
            type: "post",
            memberOf: ["group-public-content"],
            image: "test-data",
            tags: ["tag-category1", "tag-topicA"],
        };

        // check if an update is emitted with the updated document
        const postUpdateHandler = (update: any) => {
            if (update.type === DocType.Post) {
                expect(update._id).toBe("post-post1");
                expect(update.image).toBe("test-data");
                service.off("update", postUpdateHandler);
            }
        };

        // check if an update is emitted with the change document
        const changeUpdateHandler = (update: any) => {
            if (update.type === DocType.Change) {
                expect(update.docId).toBe("post-post1");
                expect(update.change.image).toBe("test-data");
                service.off("update", changeUpdateHandler);
            }
        };

        service.on("update", postUpdateHandler);
        service.on("update", changeUpdateHandler);

        await service.upsertDoc(doc);
    });

    // =================== getUserGroups ===================

    it("can retrieve a list of groups from the db (getUserGroups)", async () => {
        const userAccess = new Map<DocType, Uuid[]>();
        userAccess[DocType.Group] = [
            "group-super-admins",
            "group-public-content",
            "group-private-content",
            "group-public-tags",
            "group-private-tags",
            "group-public-users",
            "group-private-users",
        ];

        const res: any = await service.getUserGroups(userAccess);

        expect(res.docs).toBeDefined();
        expect(res.docs.length).toBeGreaterThan(0);
    });

    it("returns no groups if user does not have the right access (getUserGroups)", async () => {
        const userAccess = new Map<DocType, Uuid[]>();
        userAccess[DocType.Post] = ["group-super-admins"];

        const res: any = await service.getUserGroups(userAccess);

        expect(res.docs).toBeDefined();
        expect(res.docs.length).toBe(0);
    });

    // =================== getUserGroups ===================

    // =================== queryDocs ===================
    it("can retrieve documents queryDocs, with a limit of 10 (queryDocs)", async () => {
        const userAccess = new Map<DocType, Uuid[]>();
        userAccess[DocType.Post] = ["group-public-content"];
        userAccess[DocType.Tag] = [
            "group-super-admins",
            "group-public-content",
            "group-private-content",
        ];
        userAccess[DocType.Group] = [
            "group-super-admins",
            "group-public-content",
            "group-private-content",
        ];
        const options = {
            userAccess: userAccess,
            types: [DocType.Post, DocType.Tag, DocType.Language, DocType.Group],
            groups: ["group-super-admins", "group-public-content", "group-private-content"],
            limit: 10,
        };

        const res = await service.queryDocs(options);
        expect(res.docs.length).toBe(10);
    });

    it("can retrieve documents queryDocs, between 2 timestamps (queryDocs)", async () => {
        const userAccess = new Map<DocType, Uuid[]>();
        userAccess[DocType.Post] = [
            "group-super-admins",
            "group-public-content",
            "group-private-content",
        ];
        userAccess[DocType.Tag] = [
            "group-super-admins",
            "group-public-content",
            "group-private-content",
        ];
        userAccess[DocType.Group] = [
            "group-super-admins",
            "group-public-content",
            "group-private-content",
        ];
        const options = {
            userAccess: userAccess,
            types: [DocType.Post, DocType.Tag, DocType.Language, DocType.Group],
            groups: ["group-super-admins", "group-public-content", "group-private-content"],
            limit: 30,
            to: undefined,
            from: undefined,
        };

        // retrieve current timestamps
        const res = await service.queryDocs(options);
        options.to = res.docs[10].updatedTimeUtc;
        options.from = res.docs[res.docs.length - 10].updatedTimeUtc;

        const res2 = await service.queryDocs(options);
        expect(res2.docs.length).toBeGreaterThan(0);
    });

    it("can sort documents in ascending and descending order (queryDocs)", async () => {
        const userAccess = new Map<DocType, Uuid[]>();
        userAccess[DocType.Post] = [
            "group-super-admins",
            "group-public-content",
            "group-private-content",
        ];
        userAccess[DocType.Tag] = [
            "group-super-admins",
            "group-public-content",
            "group-private-content",
        ];
        userAccess[DocType.Group] = [
            "group-super-admins",
            "group-public-content",
            "group-private-content",
        ];
        const options = {
            userAccess: userAccess,
            types: [DocType.Post, DocType.Tag, DocType.Language, DocType.Group],
            groups: ["group-super-admins", "group-public-content", "group-private-content"],
            limit: 10,
            sort: [{ updatedTimeUtc: "asc" }],
        };

        const res = await service.queryDocs(options);

        options.sort = [{ updatedTimeUtc: "desc" }];
        const res2 = await service.queryDocs(options);

        expect(res.docs[9]?.updatedTimeUtc).toBeGreaterThan(res.docs[0]?.updatedTimeUtc);
        expect(res2.docs[0]?.updatedTimeUtc).toBeGreaterThan(res2.docs[9]?.updatedTimeUtc);
    });

    it("returns no data if user has no access (queryDocs)", async () => {
        const userAccess = new Map<DocType, Uuid[]>();
        const options = {
            userAccess: userAccess,
            types: [DocType.Post, DocType.Tag, DocType.Language, DocType.Group],
            groups: ["group-super-admins", "group-public-content", "group-private-content"],
        };

        const res = await service.queryDocs(options);

        expect(res.docs.length).toBeLessThan(1);
    });

    it("use default all groups if the user does not provide an array of groups (queryDocs)", async () => {
        const userAccess = new Map<DocType, Uuid[]>();
        userAccess[DocType.Post] = [
            "group-super-admins",
            "group-public-content",
            "group-private-content",
        ];
        userAccess[DocType.Tag] = [
            "group-super-admins",
            "group-public-content",
            "group-private-content",
        ];
        userAccess[DocType.Group] = [
            "group-super-admins",
            "group-public-content",
            "group-private-content",
        ];
        const options = {
            userAccess: userAccess,
            types: [DocType.Post, DocType.Tag, DocType.Language], // need to exclude group type, since it does not check the groups array for this
        };

        const res = await service.queryDocs(options);

        expect(res.docs.length).toBeGreaterThan(1);
    });

    it("can request content docs only (queryDocs)", async () => {
        const userAccess = new Map<DocType, Uuid[]>();
        userAccess[DocType.Post] = [
            "group-super-admins",
            "group-public-content",
            "group-private-content",
        ];
        userAccess[DocType.Tag] = [
            "group-super-admins",
            "group-public-content",
            "group-private-content",
        ];
        userAccess[DocType.Group] = [
            "group-super-admins",
            "group-public-content",
            "group-private-content",
        ];
        const options = {
            userAccess: userAccess,
            types: [DocType.Post, DocType.Tag, DocType.Language], // need to exclude group type, since it does not check the groups array for this
            contentOnly: true,
            groups: ["group-super-admins", "group-public-content", "group-private-content"],
        };

        const res = await service.queryDocs(options);
        const notContentDocs = res.docs.filter((d) => d.type !== DocType.Content);

        expect(notContentDocs.length).toBeLessThan(1);
    });

    it("can retrieve only a specific language from the api", async () => {
        const userAccess = new Map<DocType, Uuid[]>();
        userAccess[DocType.Post] = [
            "group-super-admins",
            "group-public-content",
            "group-private-content",
        ];
        userAccess[DocType.Tag] = [
            "group-super-admins",
            "group-public-content",
            "group-private-content",
        ];
        userAccess[DocType.Group] = [
            "group-super-admins",
            "group-public-content",
            "group-private-content",
        ];
        userAccess[DocType.Language] = [
            "group-super-admins",
            "group-public-content",
            "group-private-content",
        ];
        const options = {
            userAccess: userAccess,
            types: [DocType.Post, DocType.Tag, DocType.Language], // need to exclude group type, since it does not check the groups array for this
            contentOnly: true,
            groups: ["group-super-admins", "group-public-content", "group-private-content"],
            languages: ["lang-eng"],
        };

        const res = await service.queryDocs(options);
        const notEnglishDocs = res.docs.filter((d) => d.language !== "lang-eng");

        expect(res.docs.length).toBeGreaterThan(1);
        expect(notEnglishDocs.length).toBeLessThan(1);
    }, 30000);

    // =================== queryDocs ===================
});
