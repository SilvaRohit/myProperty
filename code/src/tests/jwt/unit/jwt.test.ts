import { describe, it, expect, beforeEach } from "vitest";
import jsonwebtoken from "jsonwebtoken";
import jwt from "$lib/server/jwt/jwt";

describe("JWT Tests", () => {
    //setup the variables
    let payload:any;
    let email:string;
    let userId:string;
    let secret:string;
    let expire:string;
    let fakeToken:string;

    // Create fresh fixtures so valid-token tests do not expire over time.
    beforeEach(()=>{
        //the secret
        secret = "topSecret";
        //set to a long expire time for ease of testing
        expire = "30d";

        //a fake username and email that will be used as part of the payload to generate the token
        email = "admin@myproperty.com";
        userId = "123456";

        //the payload consists of the userId and email
        payload = {
            userId: userId,
            email:email
        };
        fakeToken = jsonwebtoken.sign(payload, secret, { expiresIn: "1h" });
    });

    //throw an error if secret is not provided
    it('should throw an error if secret is not provided', async () => {
        expect(()=>jwt.generate(payload, "", expire)).toThrowError("SECRET missing from the env");
    });

    it('should throw an error if the expire is not provided', async () => {
        expect(()=>jwt.generate(payload, secret, "")).toThrowError("EXPIRATION_TIME missing from the env");
    });

    //successfully generate a string of token
    it('should generate a token', async () => {
        const token = jwt.generate(payload, secret, expire);
        //console.log(token);
        expect(token).toBeDefined();
        expect(token).toBeTypeOf("string");
        //assert partial of the token to ensure we are getting a token
        expect(token).toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
    });

   
    //successfully verify the token
    it('should successfully verify the token', async()=>{
        const res = jwt.verifyToken(fakeToken, secret);
        expect(res).toBe(true);
    });

    it('should throw a user exception if the token is invalid', async()=>{
        expect(()=>jwt.verifyToken("invalidToken", secret)).toThrowError("Invalid token");
    });

    it('should reject an expired token', () => {
        const expiredToken = jsonwebtoken.sign(payload, secret, { expiresIn: -1 });
        expect(() => jwt.verifyToken(expiredToken, secret)).toThrowError("Invalid token");
    });

    it('should reject a token signed with a different secret', () => {
        const wrongSecretToken = jsonwebtoken.sign(payload, "another-test-secret", { expiresIn: "1h" });
        expect(() => jwt.verifyToken(wrongSecretToken, secret)).toThrowError("Invalid token");
    });

    //should successfully decoded a toekn
    it('should successfully decoded the token', async()=>{
        const res = jwt.decodeToken(fakeToken);
        expect(res).toBeDefined();
        expect(res).toBeTypeOf("object");
        expect(res.userId).toBe(userId);
        expect(res.email).toBe(email);
    });
});
