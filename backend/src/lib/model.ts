import {
  Collection,
  ObjectId,
  Filter,
  Document,
  WithId,
  OptionalUnlessRequiredId,
} from "mongodb";
import { getDb } from "./db";

/**
 * Base document shape stored in MongoDB.
 * Every document has a serviceProvider name and a dynamic attributes map.
 * All other metadata (createdAt, updatedAt) is managed by the Model layer.
 */
export interface BaseDocument extends Document {
  _id?: ObjectId;
  serviceProvider: string;
  attributes: Record<string, string | null>;
  passwordHistory?: { password: string; changedAt: Date }[];
  source: "manual" | "import";
  createdAt: Date;
  updatedAt: Date;
}

/** Minimal document shape — used for collections that don't follow the accounts schema */
export interface MinimalDocument extends Document {
  _id?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Generic Model class — provides a full CRUD database layer for any collection.
 * No ORM, no schema enforcement. Works with any shape of data via the
 * `attributes` dynamic map.
 *
 * Usage:
 *   const AccountModel = new Model("accounts");
 *   const all = await AccountModel.findAll();
 */
export class Model<T extends MinimalDocument = BaseDocument> {
  private collectionName: string;

  constructor(collectionName: string) {
    this.collectionName = collectionName;
  }

  private async getCollection(): Promise<Collection<T>> {
    const db = await getDb();
    return db.collection<T>(this.collectionName);
  }

  /**
   * Find all documents in the collection.
   */
  async findAll(): Promise<WithId<T>[]> {
    const collection = await this.getCollection();
    return collection.find({} as Filter<T>).sort({ serviceProvider: 1, createdAt: -1 }).toArray();
  }

  /**
   * Find documents matching a filter.
   */
  async findBy(filter: Filter<T>): Promise<WithId<T>[]> {
    const collection = await this.getCollection();
    return collection.find(filter).toArray();
  }

  /**
   * Find a single document by its MongoDB ObjectId string.
   */
  async findById(id: string): Promise<WithId<T> | null> {
    if (!ObjectId.isValid(id)) return null;
    const collection = await this.getCollection();
    return collection.findOne({ _id: new ObjectId(id) } as Filter<T>);
  }

  /**
   * Find a single document matching a filter.
   */
  async findOne(filter: Filter<T>): Promise<WithId<T> | null> {
    const collection = await this.getCollection();
    return collection.findOne(filter);
  }

  /**
   * Insert a new document. Automatically adds createdAt and updatedAt.
   * Returns the inserted document with its generated _id.
   */
  async insertOne(
    data: Omit<T, "_id" | "createdAt" | "updatedAt">
  ): Promise<WithId<T>> {
    const collection = await this.getCollection();
    const now = new Date();
    const doc = {
      ...data,
      createdAt: now,
      updatedAt: now,
    } as OptionalUnlessRequiredId<T>;

    const result = await collection.insertOne(doc);
    return { ...doc, _id: result.insertedId } as WithId<T>;
  }

  /**
   * Update a document by its MongoDB ObjectId string.
   * Merges the provided fields (partial update) and bumps updatedAt.
   * Returns the updated document, or null if not found.
   */
  async updateOne(
    id: string,
    data: Partial<Omit<T, "_id" | "createdAt">>
  ): Promise<WithId<T> | null> {
    if (!ObjectId.isValid(id)) return null;
    const collection = await this.getCollection();
    const now = new Date();

    await collection.updateOne(
      { _id: new ObjectId(id) } as Filter<T>,
      { $set: { ...data, updatedAt: now } as Partial<T> }
    );

    return this.findById(id);
  }

  /**
   * Delete a document by its MongoDB ObjectId string.
   * Returns true if deleted, false if not found.
   */
  async deleteOne(id: string): Promise<boolean> {
    if (!ObjectId.isValid(id)) return false;
    const collection = await this.getCollection();
    const result = await collection.deleteOne({
      _id: new ObjectId(id),
    } as Filter<T>);
    return result.deletedCount === 1;
  }

  /**
   * Count documents matching a filter (or all documents if no filter).
   */
  async count(filter?: Filter<T>): Promise<number> {
    const collection = await this.getCollection();
    return collection.countDocuments((filter ?? {}) as Filter<T>);
  }

  /**
   * Get all unique values for a specific field across the collection.
   */
  async distinct(field: string): Promise<unknown[]> {
    const collection = await this.getCollection();
    return collection.distinct(field);
  }
}

// ─── Instantiated Models ─────────────────────────────────────────────────────

/** Model for the accounts collection */
export const AccountModel = new Model<BaseDocument>("accounts");

/** Model for the users collection (auth) */
export interface UserDocument extends MinimalDocument {
  _id?: ObjectId;
  username: string;
  passwordHash: string;
  mfaSecret?: string;
  mfaEnabled?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const UserModel = new Model<UserDocument>("users");
