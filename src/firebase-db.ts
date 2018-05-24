import { notNull } from "./fns/firebase-db-util";

import * as admin from "firebase-admin";
import * as path from "path";


let _database: FirebaseFirestore.Firestore;

export class FirebaseDb {
  public static connect(database: FirebaseFirestore.Firestore) {
    _database = database;
  }

  private static getDb() {
    if (!_database) {
      throw new Error(
        "Firebase-db database is not connected, please call FirebaseDb.connect(admin.database()) first"
      );
    }
    return _database;
  }

  static insert(pathValue: string, data: any): Promise<string> {
    notNull(data, "data");
    notNull(pathValue, "pathValue");

    const db = this.getDb();
    const id = this.generateID();

    return db.collection(pathValue)
      .doc(id)
      .set({
        ...data,
        id
      })
      .then(() => id);
  }

  static insertWithId(
    pathValue: string,
    id: string,
    data: any
  ): Promise<string> {
    notNull(data, "data");
    notNull(pathValue, "pathValue");
    notNull(id, "id");

    const db = this.getDb();

    return db.collection(pathValue).doc(id).set(data)
      .then(() => id);
  }

  static insertAndGet(pathValue: string, data: any): Promise<any> {
    return this.insert(pathValue, data).then(id => {
      return this.get(pathValue, id);
    });
  }

  static exists(pathValue: string, id?: string): Promise<boolean> {
    notNull(pathValue, "pathValue");
    if (id) {
      pathValue = path.posix.join(pathValue, id);
    }
    const db = this.getDb();
    return db.doc(pathValue).get()
      .then(doc => doc.exists)
  }

  static get(pathValue: string, id: string): Promise<any> {
    notNull(id, "id");
    notNull(pathValue, "pathValue");

    pathValue = path.posix.join(pathValue, id);
    const db = this.getDb();

    return db.doc(pathValue).get()
      .then(snapshot => {
        if (!snapshot.exists) {
          return Promise.reject(
            new ReferenceError(`unknown id(${id}) for ref(${pathValue})`)
          );
        }
        return snapshot.data();
      });
  }

  static getAll(pathValue: string): Promise<any[]> {
    notNull(pathValue, "pathValue");

    const db = this.getDb();
    
    return db.collection(pathValue).get()
      .then(snapshot => {
        const result = [];
        snapshot.forEach(doc => {
          result.push(doc.data());
        });
        return result;
      });
  }

  static update(pathValue: string, id: string, data: any): Promise<void> {
    notNull(id, "id");
    notNull(pathValue, "pathValue");
    notNull(data, "data");

    return this.get(pathValue, id)
      .then(() => {

        pathValue = path.posix.join(pathValue, id);
        const db = this.getDb();
        return db.doc(pathValue).update({
          ...data,
          id
        })
          .then(() => {});
      });
  }

  static set(pathValue: string, data: any): Promise<void> {
    notNull(pathValue, "pathValue");
    notNull(data, "data");

    const db = this.getDb();
    return db.doc(pathValue).set(data)
      .then(() => {});
  }

  static updateFields(
    pathValue: string,
    id: string,
    fields: object
  ): Promise<void> {
    notNull(id, "id");
    notNull(pathValue, "pathValue");
    notNull(fields, "fields");

    return this.get(pathValue, id)
      .then(originalItem => {

        pathValue = path.posix.join(pathValue, id);
        const db = this.getDb();
        return db.doc(pathValue).set({
          ...originalItem,
          ...fields,
          id
        })
          .then(() => {});
      });
  }

  static updateFieldsAndGet(
    pathValue: string,
    id: string,
    fields: object
  ): Promise<any> {
    return this.updateFields(pathValue, id, fields).then(() => {
      return this.get(pathValue, id);
    });
  }

  static updateAndGet(pathValue: string, id: string, data: any): Promise<any> {
    return this.update(pathValue, id, data).then(() => {
      return this.get(pathValue, id);
    });
  }

  static delete(pathValue: string, id: string): Promise<void> {
    notNull(id, "id");
    notNull(pathValue, "pathValue");

    pathValue = path.posix.join(pathValue, id);

    const db = this.getDb();
    return db.doc(pathValue).get()
      .then(snapshot => {
        if (!snapshot.exists) {
          return Promise.reject(
            new ReferenceError(`unknown id(${id}) for ref(${pathValue})`)
          );
        }
        return snapshot.ref.delete();
      })
      .then(() => {});
  }

  static deleteAll(pathValue: string): Promise<void> {
    notNull(pathValue, "pathValue");

    const db = this.getDb();
    return db.collection(pathValue).get()
      .then(snapshot => {
        const promises = snapshot.docs.map(doc => doc.ref.delete());
        return Promise.all(promises);
      })
      .then(() => {});
  }

  /**
   * This function was grabbed from firestore's console source code
   */
  static generateID(): string {
    let a = '';
    for (let b = 0; 20 > b; b++) {
      a+= 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'.charAt(Math.floor(62 * Math.random()));
    }
    return a;
  }
}
