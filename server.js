const express = require("express");
const app = express();
const session = require("express-session");
require('dotenv').config();

// express-session 설정
app.use(session({
    secret: process.env.SECRET, // 세션 암호화를 위한 시크릿 키, 실제로는 더 복잡한 값을 사용해야 합니다.
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // HTTPS를 사용하지 않을 경우 false로 설정
}));

// 미들웨어: 로그인 여부 확인
function checkLogin(req, res, next) {
    if (req.session.user) {
        // 사용자가 로그인한 경우 다음 미들웨어 또는 라우트 핸들러로 진행
        next();
    } else {
        // 사용자가 로그인하지 않은 경우 로그인 페이지로 리디렉션 또는 에러 처리
        res.status(401).json({ error: "로그인이 필요합니다." });
        // 또는 로그인 페이지로 리디렉션: res.redirect('/login');
    }
}

const { MongoClient, ObjectId } = require('mongodb');

const url = process.env.DB_URL;
const client = new MongoClient(url, { useNewUrlParser: true });

const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger'); // Swagger 설정 파일 경로
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

const bcrypt = require('bcrypt');

let mydb;

app.use(express.json());


app.listen(3000, async () => {
    console.log("Server started");
    try {
        await client.connect();
        console.log("MongoDB connected");
        mydb = client.db('myboard');
    } catch (error) {
        console.error("MongoDB connection error:", error);
    }
});

/**
 * @swagger
 * /:
 *   get:
 *     summary: 홈 페이지
 *     description: 홈 페이지를 불러옵니다.
 *     responses:
 *       '200':
 *         description: 성공적으로 요청 완료
 */
app.get("/", (req, res) => {
    res.json({ message: "Hello, World!" });
});

/**
 * @swagger
 * /list:
 *   get:
 *     summary: 게시물 목록 조회
 *     description: 모든 게시물 목록을 조회합니다.
 *     responses:
 *       '200':
 *         description: 성공적으로 요청 완료
 *       '500':
 *         description: 데이터베이스 조회 오류
 */
app.get("/list", async (req, res) => {
    try {
        const data = await mydb.collection('post').find({}).toArray();
        res.json(data);
    } catch (error) {
        console.error("Database query error:", error);
        res.status(500).json({ error: "Database query error" });
    }
})

/**
 * @swagger
 * /content/{id}:
 *   get:
 *     summary: 게시물 조회
 *     description: 특정 게시물을 조회합니다.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: 조회할 게시물의 ID
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: 성공적으로 요청 완료
 *       '404':
 *         description: 해당 ID의 게시물을 찾을 수 없음
 *       '500':
 *         description: 데이터베이스 조회 오류
 */
app.get("/content/:id", async (req, res) => {
    const postId = req.params.id;
    try {
        const post = await mydb.collection('post').findOne({ _id: new ObjectId(postId) });

        if (!post) {
            res.status(404).json({ error: "Post not found" });
            return;
        }

        res.json(post);
    } catch (error) {
        console.error("Database query error:", error);
        res.status(500).json({ error: "Database query error" });
    }
});

/**
 * @swagger
 * /content:
 *   post:
 *     summary: 게시물 작성
 *     description: 새로운 게시물을 작성합니다.
 *     parameters:
 *       - in: body
 *         name: post
 *         description: The post to create.
 *         schema:
 *           type: object
 *           properties:
 *             title:
 *               type: string
 *               example: 제목입니다
 *             content:
 *               type: string
 *               example: 내용입니다
 *           required:
 *             - title
 *             - content
 *     responses:
 *       '201':
 *         description: 성공적으로 게시물 작성 완료
 *       '400':
 *         description: 제목과 내용이 필요함
 *       '500':
 *         description: 데이터베이스 쿼리 오류
 */
app.post("/content", async (req, res) => {
    try {
        const { title, content } = req.body;

        if (!title || !content) {
            res.status(400).json({ error: "Title and content are required" });
            return;
        }

        const result = await mydb.collection('post').insertOne({ title, content });

        // 새로 생성된 게시물을 조회하고 201 상태 코드로 응답합니다.
        const newPost = await mydb.collection('post').findOne({ _id: result.insertedId });
        res.status(201).json(newPost);
    } catch (error) {
        console.error("Database query error:", error);
        res.status(500).json({ error: "Database query error" });
    }
});

/**
 * @swagger
 * /content/{id}:
 *   delete:
 *     summary: 게시물 삭제
 *     description: 특정 게시물을 삭제합니다.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: 삭제할 게시물의 ID
 *         schema:
 *           type: string
 *     responses:
 *       '204':
 *         description: 성공적으로 요청 완료 (콘텐츠 없음)
 *       '404':
 *         description: 해당 ID의 게시물을 찾을 수 없음
 *       '500':
 *         description: 데이터베이스 삭제 오류
 */
app.delete("/content/:id", async (req, res) => {
    const postId = req.params.id; // URL 매개변수에서 ID를 가져옵니다.
    try {
        const result = await mydb.collection('post').deleteOne({ _id: new ObjectId(postId) });

        if (result.deletedCount === 0) {
            // 해당 ID의 게시물이 없을 경우 404 에러를 응답합니다.
            res.status(404).json({ error: "Post not found" });
            return;
        }

        // 성공적으로 삭제되었음을 나타내는 204 상태 코드를 응답합니다.
        res.status(204).send();
    } catch (error) {
        console.error("Database query error:", error);
        res.status(500).json({ error: "Database query error" });
    }
});

/**
 * @swagger
 * /content/{id}:
 *   put:
 *     summary: 게시물 수정
 *     description: 게시물을 수정합니다.
 *     parameters:
 *       - in: path
 *         name: id
 *         description: 수정할 게시물의 ID
 *         required: true
 *         schema:
 *           type: string
 *         example: 12345
 *       - in: body
 *         name: post
 *         description: 수정할 게시물 정보
 *         required: true
 *         schema:
 *           type: object
 *           properties:
 *             title:
 *               type: string
 *               example: 수정된 제목
 *             content:
 *               type: string
 *               example: 수정된 내용
 *           required:
 *             - title
 *             - content
 *     responses:
 *       '200':
 *         description: 성공적으로 게시물 수정 완료
 *       '400':
 *         description: 제목과 내용이 필요함
 *       '404':
 *         description: 해당 ID의 게시물을 찾을 수 없음
 *       '500':
 *         description: 데이터베이스 쿼리 오류
 */
app.put("/content/:id", async (req, res) => {
    const postId = req.params.id; // URL 매개변수에서 ID를 가져옵니다.
    try {
        const { title, content } = req.body;

        if (!title || !content) {
            res.status(400).json({ error: "Title and content are required" });
            return;
        }


        const result = await mydb.collection('post').updateOne(
            { _id: new ObjectId(postId) },
            { $set: { title, content } }
        );

        if (result.matchedCount === 0) {
            // 해당 ID의 게시물이 없을 경우 404 에러를 응답합니다.
            res.status(404).json({ error: "Post not found" });
            return;
        }

        // 수정된 게시물을 조회하고 200 상태 코드로 응답합니다.
        const updatedPost = await mydb.collection('post').findOne({ _id: new ObjectId(postId) });
        res.json(updatedPost);
    } catch (error) {
        console.error("Database query error:", error);
        res.status(500).json({ error: "Database query error" });
    }
});

/**
 * @swagger
 * /signup:
 *   post:
 *     summary: 사용자 회원가입
 *     description: 새로운 사용자를 등록하고 회원 가입을 수행합니다.
 *     parameters:
 *       - in: body
 *         name: user
 *         description: 가입할 유저 정보
 *         required: true
 *         schema:
 *           type: object
 *           properties:
 *             username:
 *               type: string
 *               example: 사용자명
 *             password:
 *               type: string
 *               example: 패스워드
 *           required:
 *             - username
 *             - password
 *     responses:
 *       '201':
 *         description: 회원 가입 완료
 *       '400':
 *         description: 사용자 이름과 비밀번호 필요 또는 이미 존재하는 사용자명
 *       '500':
 *         description: 데이터베이스 쿼리 오류
 */
app.post("/signup", async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: "Username and password are required" });
        }

        // 사용자명 (id) 중복 검사
        const existingUser = await mydb.collection('user').findOne({ username });
        if (existingUser) {
            return res.status(400).json({ error: "이미 존재하는 사용자명입니다." });
        }

        // 사용자 생성 및 저장 (비밀번호 해싱)
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = { username, password: hashedPassword };

        // MongoDB에 사용자 저장
        await mydb.collection('user').insertOne(user);

        res.status(201).json({ message: "회원가입이 완료되었습니다." });
    } catch (error) {
        console.error("Database query error:", error);
        res.status(500).json({ error: "Database query error" });
    }
});


/**
 * @swagger
 * /login:
 *   post:
 *     summary: 사용자 로그인
 *     description: 사용자 로그인을 수행합니다.
 *     parameters:
 *       - in: body
 *         name: user
 *         description: 로그인할 유저 정보
 *         required: true
 *         schema:
 *           type: object
 *           properties:
 *             username:
 *               type: string
 *               example: 사용자명
 *             password:
 *               type: string
 *               example: 패스워드
 *           required:
 *             - username
 *             - password
 *     responses:
 *       '200':
 *         description: 로그인 성공
 *       '400':
 *         description: 사용자 이름과 비밀번호 필요
 *       '401':
 *         description: 사용자가 존재하지 않거나 비밀번호가 일치하지 않음
 *       '500':
 *         description: 데이터베이스 쿼리 오류
 */
app.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: "Username and password are required" });
        }

        // MongoDB에서 사용자 조회
        const user = await mydb.collection('user').findOne({ username });

        if (!user) {
            return res.status(401).json({ error: "사용자가 존재하지 않습니다." });
        }

        // 비밀번호 비교
        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
            return res.status(401).json({ error: "비밀번호가 일치하지 않습니다." });
        }

        // 로그인 성공 시 세션에 사용자 정보 저장
        req.session.user = user;

        res.json({ message: "로그인 성공", user: { username } });
    } catch (error) {
        console.error("Database query error:", error);
        res.status(500).json({ error: "Database query error" });
    }
});

/**
 * @swagger
 * /users:
 *   get:
 *     summary: 사용자 목록 조회
 *     description: 등록된 모든 사용자 목록을 조회합니다.
 *     responses:
 *       '200':
 *         description: 성공적으로 요청 완료
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   username:
 *                     type: string
 *                     example: 사용자명
 *       '500':
 *         description: 데이터베이스 조회 오류
 */
app.get("/users", async (req, res) => {
    try {
        const users = await mydb.collection('user').find({}, { projection: { password: 0 } }).toArray();
        res.json(users);
    } catch (error) {
        console.error("Database query error:", error);
        res.status(500).json({ error: "Database query error" });
    }
});

/**
 * @swagger
 * /logout:
 *   get:
 *     summary: 사용자 로그아웃
 *     description: 사용자 로그아웃을 수행합니다.
 *     responses:
 *       '200':
 *         description: 로그아웃 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 로그아웃되었습니다.
 *       '500':
 *         description: 세션 제거 오류
 */
app.get("/logout", (req, res) => {
    // 세션에서 사용자 정보를 제거
    req.session.destroy((err) => {
        if (err) {
            console.error("세션 제거 오류:", err);
            res.status(500).json({ error: "세션 제거 오류" });
        } else {
            res.status(200).json({ message: "로그아웃되었습니다." });
        }
    });
});

/**
 * @swagger
 * /welcome:
 *   get:
 *     summary: 환영 메시지 조회
 *     description: 사용자 로그인 여부에 따라 환영 메시지를 반환합니다.
 *     responses:
 *       '200':
 *         description: 로그인한 경우, 사용자에게 환영 메시지를 반환합니다.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 안녕하세요, 사용자명님
 *       '401':
 *         description: 로그인하지 않은 경우, 인증되지 않음을 나타내는 상태 코드를 반환합니다.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: 로그인이 필요합니다.
 */
app.get("/welcome", checkLogin, (req, res) => {
    if (req.session.user) {
        // 사용자가 로그인한 경우
        const welcomeMessage = `안녕하세요, ${req.session.user.username}님`;
        res.status(200).json({ message: welcomeMessage });
    } else {
        // 사용자가 로그인하지 않은 경우
        res.status(401).json({ error: "로그인이 필요합니다." });
    }
});