import { FirebaseDb } from "../firebase-db";

import "mocha";
import { assert, expect, should } from "chai";
import * as sinon from "sinon";
import * as admin from "firebase-admin";
import * as path from "path";
import * as randomString from "randomstring";

import { isEmpty } from "lodash";

import * as chai from "chai";
import * as chaiShallowDeepEqual from "chai-shallow-deep-equal";
import * as chaiAsPromised from "chai-as-promised";
chai.use(chaiShallowDeepEqual);
chai.use(chaiAsPromised);

process.env.NODE_ENV = "test";

require("dotenv").config();

describe("FirebaseDb", () => {
  let adminInitStub, configStub;
  let databaseStub;
  let refStub, pushStub;

  const testCollection = "__testCollection";
  const fetchDocument = (id: string): Promise<any> => {
    const refValue = path.posix.join(testCollection, id);

    return admin.firestore()
      .doc(refValue)
      .get()
      .then(snapshot => {
        return snapshot.data()
      });
  };
  const fetchAllDocuments = (): Promise<any[]> => {;
    return admin.firestore()
      .collection(testCollection)
      .get()
      .then(snapshot => {
        const docs = [];
        snapshot.forEach(doc => {
          docs.push(doc.data());
        })
        return docs;
      });
  };
  const clearDb = async () => {
    return admin.firestore().collection(testCollection).get()
      .then(snapshot => {
        const promises = snapshot.docs.map(doc => doc.ref.delete());
        return Promise.all(promises);
      })
  };

  before(() => {
    const serviceAccount = require("./../../secrets/firebase-adminsdk.json");
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    FirebaseDb.connect(admin.firestore());
  });

  describe("Insert", () => {
    it("should insert data into database with auto id generation, except date", async () => {
      const data = {
        string: "Testing data",
        trueBoolean: true,
        falseBoolean: false,
        number: 12341,
        float: 3.141592654,
        object: {
          firstProp: 1,
          secondProp: "2",
          nestedObject: {
            moreProp: false
          }
        },
        arrayOfNumbers: [1, 2, 3],
        arrayOfObjects: [{ objId: 1 }, { objId: 2 }, { objId: 3 }]
      };
      let insertedId = await FirebaseDb.insert(testCollection, data);

      const fetchResult = await fetchDocument(insertedId);
      expect(fetchResult).to.deep.equal({
        id: insertedId,
        string: "Testing data",
        trueBoolean: true,
        falseBoolean: false,
        number: 12341,
        float: 3.141592654,
        object: {
          firstProp: 1,
          secondProp: "2",
          nestedObject: {
            moreProp: false
          }
        },
        arrayOfNumbers: [1, 2, 3],
        arrayOfObjects: [{ objId: 1 }, { objId: 2 }, { objId: 3 }]
      });
    });

    it("should insert data into database with date", async () => {
      const now = new Date();
      const data = {
        string: "Testing data",
        date: now,
        object: {
          dateProp: now,
          nestedObject: {
            moreDateProp: now
          }
        }
      };
      let insertedId = await FirebaseDb.insert(testCollection, data);

      const fetchResult = await fetchDocument(insertedId);
      expect(fetchResult).to.deep.equal({
        id: insertedId,
        string: "Testing data",
        date: now,
        object: {
          dateProp: now,
          nestedObject: {
            moreDateProp: now
          }
        }
      });
    });

    it("should replace id field if id already exists in the data", async () => {
      const data = {
        id: "previousId",
        string: "some text"
      };
      let insertedId = await FirebaseDb.insert(testCollection, data);

      const fetchResult = await fetchDocument(insertedId);
      expect(fetchResult).to.deep.equal({
        id: insertedId,
        string: "some text"
      });
    });

    it("should throw error if null or undefined is inserted", async () => {
      const insertNull = () => FirebaseDb.insert(testCollection, null);
      expect(insertNull).to.throw(ReferenceError);

      const insertUndefined = () => FirebaseDb.insert(testCollection, undefined);
      expect(insertUndefined).to.throw(ReferenceError);

      const refResult = await fetchAllDocuments();
      expect(refResult).to.deep.equal([]);
    });

    afterEach(async () => {
      return await clearDb();
    });
  });


  describe("Get with id", () => {
    it("should throw reference error for null / undefined id", () => {
      expect(() => FirebaseDb.get(testCollection, null)).to.throw(ReferenceError);
      expect(() => FirebaseDb.get(testCollection, undefined)).to.throw(ReferenceError);
    });

    describe("Already populated with data", () => {
      before(async () => {
        const db = admin.firestore();
        await db.collection(testCollection).doc('testId1').set({
          id: "testId1",
          title: "hello1",
          number: 123,
          float: 3.141592654
        });

        await db.collection(testCollection).doc('testId2').set({
          id: "testId2",
          title: "hello2",
          number: 1934,
          float: 2.54
        });
      });

      it("should get specific data with id from database", async () => {
        {
          const result = await FirebaseDb.get(testCollection, "testId1");
          expect(result).to.deep.equal({
            id: "testId1",
            title: "hello1",
            number: 123,
            float: 3.141592654
          });
        }
        {
          const result = await FirebaseDb.get(testCollection, "testId2");
          expect(result).to.deep.equal({
            id: "testId2",
            title: "hello2",
            number: 1934,
            float: 2.54
          });
        }
      });

      it("should be rejected with reference error for unknown id", () => {
        expect(FirebaseDb.get(testCollection, "unknownId")).to.rejectedWith(
          ReferenceError
        );
      });

      after(async () => {
        return await clearDb();
      });
    });

    describe("Without data", () => {
      it("should be rejected with reference error for any id", () => {
        expect(FirebaseDb.get(testCollection, "anyId")).to.rejectedWith(
          ReferenceError
        );
      });
    });
  });

  describe("Get All", () => {
    describe("Already populated with data", () => {
      before(async () => {
        const db = admin.firestore();
        await db.collection(testCollection).doc('testId1').set({
          id: "testId1",
          title: "hello1"
        });

        await db.collection(testCollection).doc('testId2').set({
          id: "testId2",
          title: "hello2"
        });
      });

      it("should get all from database", async () => {
        const result = await FirebaseDb.getAll(testCollection);
        expect(result).not.to.be.null;
        expect(result).to.deep.equals([
          {
            id: "testId1",
            title: "hello1"
          },
          {
            id: "testId2",
            title: "hello2"
          }
        ]);
      });

      after(async () => {
        await clearDb();
      });
    });

    describe("Without data", () => {
      it("get all should return empty array", async () => {
        const result = await FirebaseDb.getAll(testCollection);
        expect(result).to.be.deep.equal([]);
      });
    });
  });

  describe("Update", () => {
    describe("Already populated with data", () => {
      before(async () => {
        const db = admin.firestore();
        await db.collection(testCollection).doc('testId1').set({
          id: "testId1",
          title: "hello1"
        });

        await db.collection(testCollection).doc('testId2').set({
          id: "testId2",
          title: "hello2"
        });
      });

      it("should update by id", async () => {
        await FirebaseDb.update(testCollection, "testId2", {
          id: "testId2",
          title: "helloEdited",
          moreProp: 123123
        });
        const result = await fetchDocument("testId2");
        expect(result).to.deep.equal({
          id: "testId2",
          title: "helloEdited",
          moreProp: 123123
        });
      });

      it("should throw reference error if unknown id", async () => {
        const unknownIdAction = FirebaseDb.update(testCollection, "unknownId", {
          id: "unknownId",
          title: "helloEdited",
          moreProp: 123123
        });
        expect(unknownIdAction).to.rejectedWith(ReferenceError);
      });

      it("should not update id", async () => {
        await FirebaseDb.update(testCollection, "testId2", {
          id: "editedId",
          title: "helloEdited",
          moreProp: 123123
        });
        const result = await fetchDocument("testId2");
        expect(result).to.deep.equal({
          id: "testId2",
          title: "helloEdited",
          moreProp: 123123
        });
      });

      after(async () => {
        await clearDb();
      });
    });
  });

  describe("Delete with id", () => {
    describe("Already populated with data", () => {
      beforeEach(async () => {
        const db = admin.firestore();
        await db.collection(testCollection).doc('testId1').set({
          id: "testId1",
          title: "hello1"
        });

        await db.collection(testCollection).doc('testId2').set({
          id: "testId2",
          title: "hello2"
        });
      });

      it("should delete specific id", async () => {
        await FirebaseDb.delete(testCollection, "testId2");
        const result = await fetchAllDocuments();
        expect(result).to.deep.equal([{
          id: "testId1",
          title: "hello1"
        }]);
      });

      it("should throw reference error for unknown id", async () => {
        expect(FirebaseDb.delete(testCollection, "unknownId")).to.rejectedWith(
          ReferenceError
        );
      });

      afterEach(async () => {
        await clearDb();
      });
    });
  });

  describe("Delete All", () => {
    describe("Already populated with data", () => {
      before(async () => {
        const db = admin.firestore();
        await db.collection(testCollection).doc('testId1').set({
          id: "testId1",
          title: "hello1"
        });

        await db.collection(testCollection).doc('testId2').set({
          id: "testId2",
          title: "hello2"
        });
      });

      it("should delete all within ref", async () => {
        await FirebaseDb.deleteAll(testCollection);
        const result = await fetchAllDocuments();
        expect(result).to.deep.equal([]);
      });

      after(async () => {
        await clearDb();
      });
    });
  });

  describe("Exists", () => {
    before(async () => {
      const db = admin.firestore();
      await db.collection(testCollection).doc('testId1').set({
        id: "testId1",
        title: "hello1"
      });

      await db.collection(testCollection).doc('testId2').set({
        id: "testId2",
        title: "hello2"
      });
    });

    it("should be true for specific id", async () => {
      const exists = await FirebaseDb.exists(testCollection, "testId1");
      expect(exists).to.be.true;
    });

    it("should be false for unknown id", async () => {
      const exists = await FirebaseDb.exists(testCollection, "unknownId");
      expect(exists).to.be.false;
    });

    after(async () => {
      await clearDb();
    });
  });

  after(async () => {
    await clearDb();
  });
});
