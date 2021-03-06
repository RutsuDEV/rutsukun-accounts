import createLocaleMiddleware from "express-locale";
import expressip from "express-ip";
import poweredby from "poweredby";
import morgan from "morgan";
import session from "express-session";
import MemoryStore from "memorystore";
import express from "express";
const memoryStore = MemoryStore(session);

import { Configuration, Inject as DInjected } from "@tsed/di";
import { PlatformApplication } from "@tsed/common";

import routes from "./routes";
import { cwd } from "process";
import { Config } from "./config";
import cors from "cors";
import methodOverride from "method-override";
import path from "path";
import "@tsed/typeorm";
import { LoggerService } from "./services/LoggerService";

const apiDir = __dirname;

@Configuration({
  rootDir: cwd(),
  acceptMimes: ["application/json"],
  port: Config.API.port,
  mount: {
    "/": [routes.routes.IndexRoute, routes.routes.WellKnownRoute],
    "/v1": path.join(apiDir, "routes", "v1", "**", "*.ts"),
  },
  debug: false,
  middlewares: [express.json(), express.urlencoded({ extended: true })],
  typeorm: [
    {
      name: "default",
      type: "mysql",
      host: Config.Database.host,
      port: 3306,
      username: Config.Database.user,
      password: Config.Database.pass,
      database: Config.Database.database,
      logging: Config.isLocal,
      synchronize: Config.isLocal,
      driver: require("mysql2"),
      entities: [`${apiDir}/entities/*{.ts,.js}`],
      migrations: [`${apiDir}/migrations/*{.ts,.js}`],
      subscribers: [`${apiDir}/subscriber/*{.ts,.js}`],
    },
  ],
})
export class APIServer {
  @DInjected()
  app: PlatformApplication;
  @Configuration() settings: Configuration;

  private logger: LoggerService;

  constructor(private loggerService: LoggerService) {
    this.logger = this.loggerService.child({
      label: {
        type: "http",
        name: `API Server (${Config.API.port})`,
      },
    });
  }

  public $beforeRoutesInit(): void | Promise<any> {
    this.app
      .use(cors({ origin: Config.FRONTEND.url, credentials: true }))
      .use(methodOverride());

    this.app.use(
      session({
        name: "rsid",
        secret: Config.API.cookieSecret,
        saveUninitialized: false,
        resave: false,
        store: new memoryStore({
          checkPeriod: 86400000, // prune expired entries every 24h
        }),
        cookie: {
          path: "/",
          domain: Config.API.cookieDomain,
          httpOnly: false,
          secure: false,
          expires: new Date(Date.now() + 86400 * 1000),
          maxAge: 86400 * 1000,
          //sameSite: 'strict'
        },
      })
    );
    this.app.use(morgan("dev"));
    this.app.use(poweredby(`${Config.appPackageInfo.appNameShort} API`));
    this.app.use(
      createLocaleMiddleware({
        priority: ["accept-language", "default"],
        default: "en-EN",
      })
    );
    this.app.use(expressip().getIpInfoMiddleware);
    this.app.getApp().set("json spaces", 2);
  }
}
