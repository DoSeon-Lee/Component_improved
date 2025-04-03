const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const { sequelize, User } = require("./models");

const app = express();
const port = 3200;

// RDS 데이터베이스 연결 정보
const RDS_INFO = {
  host: "hancom2.cv88qo4gg15o.ap-northeast-2.rds.amazonaws.com",
  database: "userdb",
  user: "admin",
  port: 3306,
};

// 미들웨어 설정
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");
app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// 시퀄라이즈 연결 동기화
console.log(`RDS 데이터베이스(${RDS_INFO.host}) 연결 시도 중... 포트: ${port}`);

let dbConnected = false;

// 데이터베이스 초기화 함수
async function initDatabase() {
  try {
    // 먼저 데이터베이스 연결 테스트
    await sequelize.authenticate();
    console.log("데이터베이스 연결 성공!");

    // 테이블 확인 및 생성
    await User.checkAndCreateTable();

    // 데이터베이스 동기화
    await sequelize.sync({ force: false, alter: false });

    console.log(
      `RDS 데이터베이스 초기화 성공 - ${RDS_INFO.database}.userm 테이블`
    );
    dbConnected = true;
    return true;
  } catch (err) {
    console.error("RDS 데이터베이스 초기화 실패:", err);
    console.log("데이터베이스 연결 없이 서버를 계속 실행합니다.");
    return false;
  }
}

// 서버 시작 함수
async function startServer() {
  // 데이터베이스 초기화 실행
  await initDatabase();

  // 서버 시작
  app.listen(port, () => {
    console.log(`서버가 http://localhost:${port} 에서 실행 중입니다`);
  });
}

// 라우터 설정
const indexRouter = require("./routes/index");
const usersRouter = require("./routes/users");

app.use("/", indexRouter);

// 데이터베이스 연결 확인 미들웨어
app.use(
  "/users",
  (req, res, next) => {
    if (!dbConnected) {
      return res.status(503).render("error", {
        message: "데이터베이스에 연결할 수 없습니다",
        error: {
          status: 503,
          stack: "데이터베이스 연결에 실패했습니다. 나중에 다시 시도해주세요.",
        },
      });
    }
    next();
  },
  usersRouter
);

// 404 오류 처리
app.use((req, res, next) => {
  res.status(404).render("error", {
    message: "페이지를 찾을 수 없습니다",
    error: { status: 404 },
  });
});

// 오류 처리 미들웨어
app.use((err, req, res, next) => {
  console.error("애플리케이션 오류:", err);
  const status = err.status || 500;
  res.status(status).render("error", {
    message: err.message || "서버에 오류가 발생했습니다",
    error: {
      status: status,
      stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
    },
  });
});

// 서버 시작
startServer();
