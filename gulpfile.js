/**
 * Created by nilsbergmann on 06.02.17.
 */
const gulp = require('gulp');
const gulpSequence = require('gulp-sequence');
const clean = require('gulp-clean');
const babel = require('gulp-babel');
const htmlmin = require('gulp-htmlmin');
const del = require('del');
const jeditor = require("gulp-json-editor");

const dir = "www/";

gulp.task('default', gulpSequence('clean', ['copy', 'copy-md'], ['min', 'package']));

// Clean
gulp.task('clean', function () {
    return gulp.src(dir).pipe(clean());
});

// Copy bower directory
gulp.task('copy', function () {
    return gulp.src(['src/**/*', '!src/comp/material-design-icons/**/*']).pipe(gulp.dest(dir));
});

gulp.task('copy-md', function () {
    return gulp.src(['src/comp/material-design-icons/iconfont/**/*']).pipe(gulp.dest(dir + 'comp/material-design-icons/iconfont'));
});

gulp.task('babelify', function () {
    return gulp.src(dir + '**/*.js').pipe(babel({
        presets: ['es2015']
    })).pipe(gulp.dest(dir));
});

gulp.task('min', function () {
    return gulp.src(dir + '**/*.html')
        .pipe(htmlmin({collapseWhitespace: true}))
        .pipe(gulp.dest(dir));
});

gulp.task('package', function () {
    return gulp.src('package.json').pipe(jeditor(function (json) {
        json.main = "main.js";
        delete json.build;
        return json;
    })).pipe(gulp.dest(dir));
});