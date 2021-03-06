type SchemaValue = string | number | boolean | object;

export interface Schema {
  [prop: string]: SchemaValue | Schema;
}

export interface ApiSchema {
  [prop: string]: Schema;
}

interface ApiSchemaValue {
  [prop: string]: Schema[];
}

export type FakeFunction = (prop1?: number, prop2?: number) => SchemaValue;

interface FakeTypes {
  [typeName: string]: FakeFunction;
}

interface FakerWrapper extends Faker.FakerStatic {
  [group: string]: FakeTypes | any;
}

export class SchemaFaker {
  protected callbackTypes: FakeTypes = {};
  protected locale: string;
  protected dataLength: number;

  public faker: FakerWrapper;

  constructor(locale = "en", dataLength = 10) {
    this.callbackTypes = {};
    this.dataLength = dataLength;
    this.locale = locale;
    this.faker = require(`faker/locale/${locale}`);
  }

  setLength(dataLength: number): void {
    this.dataLength = dataLength;
  }

  setLocale(locale: string): void {
    this.locale = locale;
    this.faker = require(`faker/locale/${locale}`);
  }

  getFaker(): Faker.FakerStatic {
    return this.faker;
  }

  getCallbackType(name: string): FakeFunction | undefined {
    if (this.callbackTypes.hasOwnProperty(name))
      return this.callbackTypes[name].bind(this);
  }

  addType(name: string, fn: FakeFunction): void {
    this.callbackTypes[name.toLowerCase()] = fn;
  }

  fakeDate(
    start?: Date | number | string,
    end?: Date | number | string
  ): string {
    if (typeof start === "undefined" || !start) start = new Date(2000, 1, 1);
    if (typeof start !== "object") start = new Date(start);
    if (typeof end === "undefined" || !end) end = new Date();
    if (typeof end !== "object") end = new Date(end);

    const d = new Date(
      start.getTime() + Math.random() * (end.getTime() - start.getTime())
    );
    let month = "" + (d.getMonth() + 1);
    let day = "" + d.getDate();
    const year = d.getFullYear();

    if (month.length < 2) month = "0" + month;
    if (day.length < 2) day = "0" + day;

    return [year, month, day].join("-");
  }

  fakeTime(): string {
    let h = "" + this.faker.datatype.number({ min: 0, max: 23 });
    let m = "" + this.faker.datatype.number({ min: 0, max: 59 });
    let s = "" + this.faker.datatype.number({ min: 0, max: 59 });

    if (h.length < 2) h = "0" + h;
    if (m.length < 2) m = "0" + m;
    if (s.length < 2) s = "0" + s;
    return [h, m, s].join(":");
  }

  fakeDatetime(
    start?: Date | number | string,
    end?: Date | number | string
  ): string {
    return this.fakeDate(start, end) + " " + this.fakeTime();
  }

  fakeInteger(min: number = 1, max: number = 1000000): number {
    if (min > max) max = min + 1000000;
    return this.faker.datatype.number({ min, max });
  }

  fakeFloat(min: number = 1, max: number = 1000000): number {
    if (min > max) max = min + 1000000;
    return this.faker.datatype.float({ min, max });
  }

  fakeBoolean(): boolean {
    return this.faker.datatype.boolean();
  }

  fakeString(min: number = 5, max: number = 20): string {
    return this.faker.datatype.string(this.fakeInteger(min, max));
  }

  fakeImage(width = 900, height = 600): string {
    return this.faker.image.imageUrl(width, height);
  }

  fakeName(): string {
    return this.faker.name.findName();
  }

  fakeUsername(): string {
    return this.faker.random.alphaNumeric(this.fakeInteger(6, 20));
  }

  fakeHtml(
    min = 3,
    max = 10,
    open = "<p>",
    end = "</p>",
    separator = ""
  ): string {
    const n = this.fakeInteger(min, max);
    const p = [];
    for (let i = 0; i < n; i++) {
      p.push(open + this.faker.lorem.paragraphs(1) + end);
    }
    return p.join(separator);
  }

  fake(dataType: string): SchemaValue {
    if (typeof dataType !== "string")
      throw new TypeError("Invalid type: " + JSON.stringify(dataType));

    let isRange = false;
    let min = 0;
    let max = 0;
    let rand = 0;
    /* type format: "internet.url", "address.cityName", or "lorem.words(2,3)" */
    let m = dataType.match(
      /^\s*([a-z0-9]+)\.([a-z0-9]+)\s*(\((-?[0-9]+),\s*(-?[0-9]+)\))?\s*$/i
    );
    if (m && m[1] !== "mersenne") {
      // ignore mersenne
      if (!this.faker.hasOwnProperty(m[1]) || !this.faker[m[1]])
        throw new TypeError("Invalid type: " + dataType);

      if (typeof this.faker[m[1]][m[2]] !== "function")
        throw new TypeError("Invalid type: " + dataType);
      try {
        isRange = m[4] !== undefined && m[5] !== undefined;
        min = isRange ? parseInt(m[4], 10) : 0;
        max = isRange ? parseInt(m[5], 10) : 0;
        rand = isRange ? this.fakeInteger(min, max) : 0;
        return isRange
          ? this.faker[m[1]][m[2]](rand)
          : this.faker[m[1]][m[2]]();
      } catch (e) {
        throw new TypeError("Invalid type: " + dataType);
      }
    }

    /* faker mustache format: "{{user.firstName}} lives at {{address.cityName}}" */
    if (dataType.match(/{{.+}}/)) {
      try {
        return this.faker.fake(dataType);
      } catch (e) {
        throw new TypeError("Invalid type: " + dataType);
      }
    }

    /* simple type format: "string(3,5)", "paragraphs(1,3)", "integer(5,70)", or "boolean" */
    m = dataType.match(
      /^\s*([a-z0-9]+)\s*(\((-?[0-9]+),\s*(-?[0-9]+)\))?\s*$/i
    );
    if (!m) {
      throw new TypeError("Invalid type: " + dataType);
    }

    const t = m[1].toLowerCase();
    isRange = m[3] !== undefined && m[3] !== undefined;
    min = isRange ? parseInt(m[3], 10) : 0;
    max = isRange ? parseInt(m[4], 10) : 0;
    rand = isRange ? this.fakeInteger(min, max) : 0;

    /* callback customized type */
    const cb = this.getCallbackType(t);
    if (typeof cb === "function") return isRange ? cb(min, max) : cb();

    /* This faker type */
    const funcName = ("fake" +
      t.charAt(0).toUpperCase() +
      t.slice(1)) as keyof SchemaFaker;
    if (typeof this[funcName] === "function") {
      const func = (this[funcName] as FakeFunction).bind(this);
      return isRange ? func(min, max) : func();
    }

    /* search grand children properties to find the first match */
    for (const [prop, obj] of Object.entries(this.faker)) {
      if (typeof obj[t] === "function") {
        return isRange ? obj[t](rand) : obj[t]();
      }
    }

    throw new TypeError("Invalid type: " + dataType);
  }

  fakeSchema(schema: Schema): Schema {
    if (typeof schema !== "object")
      throw new TypeError(
        "Schema must be object (got: " + JSON.stringify(schema) + ")"
      );

    const data: Schema = {};
    const self = this;

    for (const [key, value] of Object.entries(schema)) {
      if (typeof value === "object") {
        if (Array.isArray(value)) {
          data[key] = value.map((v) => {
            if (typeof v === "object") {
              return self.fakeSchema(v);
            } else if (typeof v === "string") {
              return self.fake(v as string);
            } else {
              throw new TypeError("Invalid type: " + JSON.stringify(v));
            }
          });
        } else {
          data[key] = this.fakeSchema(value as Schema);
        }
      } else if (typeof value === "string") {
        data[key] = this.fake(value as string);
      } else {
        throw new TypeError("Invalid type: " + JSON.stringify(value));
      }
    }

    return data;
  }

  fakeApi(schema: ApiSchema): ApiSchemaValue {
    if (typeof schema !== "object")
      throw new TypeError(
        "Schema must be object (got: " + JSON.stringify(schema) + ")"
      );

    const data: ApiSchemaValue = {};
    for (const [key, subSchema] of Object.entries(schema)) {
      const subData: Schema[] = [];
      for (let i = 0; i < this.dataLength; i++) {
        subData.push(this.fakeSchema(subSchema));
      }

      data[key] = subData;
    }

    return data;
  }
}
