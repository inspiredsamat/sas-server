
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import tokenService from "./tokenService.js";
import UserDto from "../dtos/users-dto.js";
import ApiError from "../exeptions/api-error.js";
import Users from "../models/users.js";
import StudentDto from '../dtos/student-dto.js';
import Students from '../models/student.js';
import { Sequelize } from 'sequelize';
import Teachers from '../models/teacher.js';
import Enrollments from '../models/enrollment.js';
import TeacherDto from '../dtos/teacher-dto.js';
import Admins from "../models/admin.js"
import AdminDto from '../dtos/admin-dto.js';
import SpecialReasons from "../models/specialReason.js";

class UserService {
  async registrationStudent(userId, password, firstName, lastName, major) {
    //checking if the id is busy.
    const candidate = await Users.findOne({ where: { userId: userId } })
    if (candidate) {
      throw ApiError.BadRequest(`Пользователь с почтовым адресом ${userId} уже существует`)
      return;
    }
    console.log(userId + " " + password + " " + firstName + " " + lastName + " " + major)

    const user = await Users.create({
      userId: userId,
      password: password,
      firstName: firstName,
      lastName: lastName,
      roleId: 'student'
    });
    console.log("Student added to Users table")
    console.log(user)
    const student = await Students.create({
      studentId: userId,
      major: major
    });
    console.log("Student added to Students table")
    console.log(student)
    const userDto = new UserDto(user);
    const studentDto = new StudentDto(user, student);
    console.log(userDto)
    const tokens = tokenService.generateTokens({ ...userDto });
    console.log(tokens)
    console.log("generate success")
    await tokenService.saveToken(userDto.userId, tokens.refreshToken);
    return { ...tokens, user: studentDto }
  }


  async login(userId, password) {
    console.log("service login params: " + userId + " " + password)
    const user = await Users.findOne({ where: { userId: userId } })
    if (!user) {
      throw ApiError.BadRequest('User with id ' + userId + ' not found!')
    }
    console.log("user findOne()" + user)
    const isPassEquals = await bcrypt.compare(password, user.password);
    if (!isPassEquals) {
      throw ApiError.BadRequest('Wrong password!');
    }
    console.log("password is correct");
    const userDto = new UserDto(user);
    const { roleId } = user;


    let dto = null;
    //if student
    if (roleId == 'student') {
      const student = await Students.findOne({ where: { studentId: userId } })
      console.log("student findOne()" + student)
      const studentDto = new StudentDto(user, student);
      dto = studentDto;
    }
    else if (roleId == 'teacher') {
      const teacher = await Teachers.findOne({ where: { teacherId: userId } })
      console.log("teacher findOne()" + teacher)
      const teacherDto = new TeacherDto(user, teacher);
      dto = teacherDto;
    }
    else {
      const admin = await Admins.findOne({ where: { adminId: userId } })
      console.log("admin findOne()" + admin)
      const adminDto = new AdminDto(user, admin);
      dto = adminDto;
    }


    const tokens = tokenService.generateTokens({ ...userDto });
    console.log("tokkens generated");
    await tokenService.saveToken(userDto.userId, tokens.refreshToken);

    return { ...tokens, user: dto }
  }
  async logout(refreshToken) {
    const token = await tokenService.removeToken(refreshToken);
    return token;
  }

  async refresh(refreshToken) {
    if (!refreshToken) {
      throw ApiError.UnauthorizedError();
    }
    const userData = tokenService.validateRefreshToken(refreshToken);
    const tokenFromDb = await tokenService.findToken(refreshToken);
    if (!userData || !tokenFromDb) {
      throw ApiError.UnauthorizedError();
    }
    const user = await Users.findOne({ where: { userId: userData.userId } })
    const student = await Students.findOne({ where: { studentId: userData.userId } })
    const userDto = new UserDto(user);
    const studentDto = new StudentDto(user, student);
    const tokens = tokenService.generateTokens({ ...userDto });

    await tokenService.saveToken(userDto.id, tokens.refreshToken);
    return { ...tokens, user: studentDto }
  }
  async getAllUsers() {

    const users = await Users.findAll();
    return users;
  }

  async searchStudent(key) {
    const students = await Students.findAll({
      where: {
        [Sequelize.Op.or]: [
          Sequelize.literal(`CAST("students"."studentId" AS TEXT) LIKE '%${key}%'`),
          {
            '$user.firstName$': { [Sequelize.Op.like]: `%${key}%` }
          },
          {
            '$user.lastName$': { [Sequelize.Op.like]: `%${key}%` }
          }
        ]
      },
      include: {
        model: Users,
        as: 'user', // set alias for the "Users" table
        attributes: ['firstName', 'lastName']
      },
      attributes: ['studentId', 'authorizedId']
    });
    return students;
  }
  async searchTeacher(key) {
    const teachers = await Teachers.findAll({
      where: {
        [Sequelize.Op.or]: [
          Sequelize.literal(`CAST("teachers"."teacherId" AS TEXT) LIKE '%${key}%'`),
          {
            '$user.firstName$': { [Sequelize.Op.like]: `%${key}%` }
          },
          {
            '$user.lastName$': { [Sequelize.Op.like]: `%${key}%` }
          }
        ]
      },
      include: {
        model: Users,
        as: 'user', // set alias for the "Users" table
        attributes: ['firstName', 'lastName']
      },
      attributes: ['teacherId', 'lessonId']
    });
    return teachers;
  }

  async lessons(studentId) {
    const lessons = await Enrollments.findAll({
      where: { studentId: studentId },
      attributes: ['studentId', 'lessonId']
    });
    console.log(lessons)
    return lessons;
  }

  async getReasons() {
    const reasons = await SpecialReasons.findAll()
    return reasons;
  }
}

export default new UserService();