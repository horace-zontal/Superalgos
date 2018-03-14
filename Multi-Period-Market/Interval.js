﻿exports.newInterval = function newInterval(BOT, UTILITIES, AZURE_FILE_STORAGE, DEBUG_MODULE, POLONIEX_CLIENT_MODULE, FILE_STORAGE, STATUS_REPORT) {

    const FULL_LOG = true;
    const LOG_FILE_CONTENT = false;

    let bot = BOT;

    const GMT_SECONDS = ':00.000 GMT+0000';
    const GMT_MILI_SECONDS = '.000 GMT+0000';
    const ONE_DAY_IN_MILISECONDS = 24 * 60 * 60 * 1000;

    const MODULE_NAME = "Interval";

    const EXCHANGE_NAME = "Poloniex";
    const EXCHANGE_ID = 1;

    const TRADES_FOLDER_NAME = "Trades";

    const CANDLES_FOLDER_NAME = "Candles";
    const CANDLES_ONE_MIN = "One-Min";

    const VOLUMES_FOLDER_NAME = "Volumes";
    const VOLUMES_ONE_MIN = "One-Min";

    const logger = DEBUG_MODULE.newDebugLog();
    logger.fileName = MODULE_NAME;
    logger.bot = bot;

    interval = {
        initialize: initialize,
        start: start
    };

    let charlyAzureFileStorage = AZURE_FILE_STORAGE.newAzureFileStorage(bot);
    let bruceAzureFileStorage = AZURE_FILE_STORAGE.newAzureFileStorage(bot);
    let oliviaAzureFileStorage = AZURE_FILE_STORAGE.newAzureFileStorage(bot);

    let utilities = UTILITIES.newUtilities(bot);

    let statusReport;
    let statusReportModule;

    return interval;

    function initialize(yearAssigend, monthAssigned, callBackFunction) {

        try {

            /* IMPORTANT NOTE:

            We are ignoring in this Interval the received Year and Month. This interval is not depending on Year Month since it procecess the whole market at once.

            */

            logger.fileName = MODULE_NAME;

            if (FULL_LOG === true) { logger.write("[INFO] initialize -> Entering function."); }
            if (FULL_LOG === true) { logger.write("[INFO] initialize -> yearAssigend = " + yearAssigend); }
            if (FULL_LOG === true) { logger.write("[INFO] initialize -> monthAssigned = " + monthAssigned); }

            charlyAzureFileStorage.initialize("Charly");
            bruceAzureFileStorage.initialize("Bruce");
            oliviaAzureFileStorage.initialize("Olivia");

            callBackFunction(global.DEFAULT_OK_RESPONSE);

        } catch (err) {
            logger.write("[ERROR] initialize -> err = " + err.message);
            callBackFunction(global.DEFAULT_FAIL_RESPONSE);
        }
    }

/*

This process is going to do the following:

Read the candles and volumes from Bruce and produce a single Index File for Market Period. 

*/

    function start(callBackFunction) {

        try {

            if (FULL_LOG === true) { logger.write("[INFO] start -> Entering function."); }

            let nextIntervalExecution = false;  // This tell weather the Interval module will be executed again or not. By default it will not unless some hole have been found in the current execution.
            let nextIntervalLapse;              // With this we can request the next execution wait time. 

            let market = global.MARKET;

            /* Context Variables */

            let lastCandleFile;                 // Datetime of the last file included on the Index Files.
            let firstTradeFile;                 // Datetime of the first trade file in the whole market history.
            let maxCandleFile;                  // Datetime of the last file available to be included in the Index File.

            getContextVariables();

            function getContextVariables() {

                try {

                    if (FULL_LOG === true) { logger.write("[INFO] start -> getContextVariables -> Entering function."); }

                    let reportFilePath;
                    let fileName = "Status.Report." + market.assetA + '_' + market.assetB + ".json"

                    if (FULL_LOG === true) { logger.write("[INFO] start -> getContextVariables -> fileName = " + fileName); }

                    getHistoricTrades();

                    function getHistoricTrades() {

                        if (FULL_LOG === true) { logger.write("[INFO] start -> getContextVariables -> getHistoricTrades -> Entering function."); }

                        /*

                        We need to know where is the begining of the market, since that will help us know where the Index Files should start. 

                        */

                        reportFilePath = EXCHANGE_NAME + "/Processes/" + "Poloniex-Historic-Trades";

                        if (FULL_LOG === true) { logger.write("[INFO] start -> getContextVariables -> getHistoricTrades -> reportFilePath = " + reportFilePath); }

                        charlyAzureFileStorage.getTextFile(reportFilePath, fileName, onFileReceived);

                        function onFileReceived(err, text) {

                            if (FULL_LOG === true) { logger.write("[INFO] start -> getContextVariables -> getHistoricTrades -> onFileReceived -> Entering function."); }
                            if (FULL_LOG === true) { logger.write("[INFO] start -> getContextVariables -> getHistoricTrades -> onFileReceived -> text = " + text); }

                            let thisReport;
 
                            if (err.result === global.CUSTOM_OK_RESPONSE.result) {
                                try {
                                    thisReport = JSON.parse(text);

                                    firstTradeFile = new Date(thisReport.lastFile.year + "-" + thisReport.lastFile.month + "-" + thisReport.lastFile.days + " " + thisReport.lastFile.hours + ":" + thisReport.lastFile.minutes + GMT_SECONDS);

                                    getOneMinDailyCandlesVolumes();

                                } catch (err) {
                                    logger.write("[ERROR] start -> getContextVariables -> getHistoricTrades -> onFileReceived -> err = " + err.message);
                                    logger.write("[ERROR] start -> getContextVariables -> getHistoricTrades -> onFileReceived -> Asuming this is a temporary situation. Requesting a Retry.");
                                    callBackFunction(global.DEFAULT_RETRY_RESPONSE);
                                }
                            } else {
                                logger.write("[ERROR] start -> getContextVariables -> getHistoricTrades -> onFileReceived -> err = " + err.message);
                                callBackFunction(err);
                            }
                        }
                    }

                    function getOneMinDailyCandlesVolumes() {

                        if (FULL_LOG === true) { logger.write("[INFO] start -> getContextVariables -> getOneMinDailyCandlesVolumes -> Entering function."); }

                        /* We need to discover the maxCandle file, which is the last file with candles we can use as input. */

                        let date = new Date();
                        let currentYear = date.getUTCFullYear();
                        let currentMonth = utilities.pad(date.getUTCMonth() + 1,2);

                        reportFilePath = EXCHANGE_NAME + "/Processes/" + "One-Min-Daily-Candles-Volumes" + "/" + currentYear + "/" + currentMonth;

                        if (FULL_LOG === true) { logger.write("[INFO] start -> getContextVariables -> getOneMinDailyCandlesVolumes -> reportFilePath = " + reportFilePath); }

                        bruceAzureFileStorage.getTextFile(reportFilePath, fileName, onFileReceived);

                        function onFileReceived(err, text) {

                            if (FULL_LOG === true) { logger.write("[INFO] start -> getContextVariables -> getOneMinDailyCandlesVolumes -> onFileReceived -> Entering function."); }
                            if (FULL_LOG === true) { logger.write("[INFO] start -> getContextVariables -> getOneMinDailyCandlesVolumes -> onFileReceived -> text = " + text); }

                            let thisReport;

                            if (err.result === global.CUSTOM_OK_RESPONSE.result) {
                                try {
                                    thisReport = JSON.parse(text);

                                    maxCandleFile = new Date(thisReport.lastFile.year + "-" + thisReport.lastFile.month + "-" + thisReport.lastFile.days + " " + "00:00" + GMT_SECONDS);

                                    getThisProcessReport();

                                } catch (err) {
                                    logger.write("[ERROR] start -> getContextVariables -> getOneMinDailyCandlesVolumes -> onFileReceived -> err = " + err.message);
                                    logger.write("[ERROR] start -> getContextVariables -> getOneMinDailyCandlesVolumes -> onFileReceived -> Asuming this is a temporary situation. Requesting a Retry.");
                                    callBackFunction(global.DEFAULT_RETRY_RESPONSE);
                                }
                            } else {
                                logger.write("[ERROR] start -> getContextVariables -> getHistoricTrades -> onFileReceived -> err = " + err.message);
                                callBackFunction(err);
                            }
                        }
                    }

                    function getThisProcessReport() {

                        if (FULL_LOG === true) { logger.write("[INFO] start -> getContextVariables -> getThisProcessReport -> Entering function."); }

                        statusReportModule = STATUS_REPORT.newStatusReport(BOT, DEBUG_MODULE, FILE_STORAGE, UTILITIES);
                        statusReportModule.initialize(bot, onInitilized);

                        function onInitilized(err) {

                            switch (err.result) {
                                case global.DEFAULT_OK_RESPONSE.result: {
                                    logger.write("[INFO] initialize -> getStatusReport -> Execution finished well. :-)");

                                    statusReport = statusReportModule.file;

                                    lastCandleFile = new Date(statusReport.lastFile.year + "-" + statusReport.lastFile.month + "-" + statusReport.lastFile.days + " " + "00:00" + GMT_SECONDS);

                                    /*
                                    Here we assume that the last day written might contain incomplete information. This actually happens every time the head of the market is reached.
                                    For that reason we go back one day, the partial information is discarded and added again with whatever new info is available.
                                    */

                                    lastCandleFile = new Date(lastCandleFile.valueOf() - ONE_DAY_IN_MILISECONDS);

                                    findPreviousContent();
                                    return;
                                }
                                case global.CUSTOM_FAIL_RESPONSE.result: {  // We need to see if we can handle this.
                                    logger.write("[ERROR] initialize -> getStatusReport -> err.message = " + err.message);

                                    if (err.message === "Status Report was never created.") {

                                        lastCandleFile = new Date(firstTradeFile.getUTCFullYear() + "-" + (firstTradeFile.getUTCMonth() + 1) + "-" + firstTradeFile.getUTCDate() + " " + "00:00" + GMT_SECONDS);

                                        lastCandleFile = new Date(lastCandleFile.valueOf() - ONE_DAY_IN_MILISECONDS); // Go back one day to start well.

                                        buildCandles();

                                    } else {
                                        callBackFunction(err);              // we cant handle this here.
                                    }
                                    return;
                                }
                                default:
                                    {
                                        logger.write("[ERROR] initialize -> getStatusReport -> Operation Failed.");
                                        callBackFunction(err);
                                        return;
                                    }
                            }
                        }
                    }
                }
                catch (err) {
                    logger.write("[ERROR] start -> getContextVariables -> err = " + err.message);
                    callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                }
            }

            function findPreviousContent() {

                try {

                    if (FULL_LOG === true) { logger.write("[INFO] start -> findPreviousContent -> Entering function."); }

                    let n = 0   // loop Variable representing each possible period as defined at the periods array.

                    let allPreviousCandles = [];
                    let allPreviousVolumes = [];

                    loopBody();

                    function loopBody() {

                        if (FULL_LOG === true) { logger.write("[INFO] start -> findPreviousContent -> loopBody -> Entering function."); }

                        let folderName = global.marketFilesPeriods[n][1];

                        let previousCandles;
                        let previousVolumes;

                        getCandles();

                        function getCandles() {

                            if (FULL_LOG === true) { logger.write("[INFO] start -> findPreviousContent -> loopBody -> getCandles -> Entering function."); }

                            let fileName = '' + market.assetA + '_' + market.assetB + '.json';

                            let filePath = EXCHANGE_NAME + "/Output/" + CANDLES_FOLDER_NAME + "/" + bot.process + "/" + folderName;

                            if (FULL_LOG === true) { logger.write("[INFO] start -> findPreviousContent -> loopBody -> getCandles -> fileName = " + fileName); }
                            if (FULL_LOG === true) { logger.write("[INFO] start -> findPreviousContent -> loopBody -> getCandles -> filePath = " + filePath); }

                            oliviaAzureFileStorage.getTextFile(filePath, fileName, onFileReceived, true);

                            function onFileReceived(err, text) {

                                if (FULL_LOG === true) { logger.write("[INFO] start -> findPreviousContent -> loopBody -> getCandles -> onFileReceived -> Entering function."); }
                                if (LOG_FILE_CONTENT === true) { logger.write("[INFO] start -> findPreviousContent -> loopBody -> getCandles -> onFileReceived -> text = " + text); }

                                let candlesFile;

                                if (err.result === global.CUSTOM_OK_RESPONSE.result) {
                                    try {
                                        candlesFile = JSON.parse(text);

                                        previousCandles = candlesFile;

                                        getVolumes();

                                    } catch (err) {
                                        logger.write("[ERROR] start -> findPreviousContent -> loopBody -> getCandles -> onFileReceived -> err = " + err.message);
                                        logger.write("[ERROR] start -> findPreviousContent -> loopBody -> getCandles -> onFileReceived -> Asuming this is a temporary situation. Requesting a Retry.");
                                        callBackFunction(global.DEFAULT_RETRY_RESPONSE);
                                    }
                                } else {
                                    logger.write("[ERROR] start -> findPreviousContent -> loopBody -> getCandles -> onFileReceived -> err = " + err.message);
                                    callBackFunction(err);
                                }
                            }
                        }

                        function getVolumes() {

                            if (FULL_LOG === true) { logger.write("[INFO] start -> findPreviousContent -> loopBody -> getVolumes -> Entering function."); }

                            let fileName = '' + market.assetA + '_' + market.assetB + '.json';

                            let filePath = EXCHANGE_NAME + "/Output/" + VOLUMES_FOLDER_NAME + "/" + bot.process + "/" + folderName;

                            if (FULL_LOG === true) { logger.write("[INFO] start -> findPreviousContent -> loopBody -> getVolumes -> fileName = " + fileName); }
                            if (FULL_LOG === true) { logger.write("[INFO] start -> findPreviousContent -> loopBody -> getVolumes -> filePath = " + filePath); }

                            oliviaAzureFileStorage.getTextFile(filePath, fileName, onFileReceived, true);

                            function onFileReceived(err, text) {

                                if (FULL_LOG === true) { logger.write("[INFO] start -> findPreviousContent -> loopBody -> getVolumes -> onFileReceived -> Entering function."); }
                                if (LOG_FILE_CONTENT === true) { logger.write("[INFO] start -> findPreviousContent -> loopBody -> getVolumes -> onFileReceived -> text = " + text); }

                                let volumesFile;

                                if (err.result === global.CUSTOM_OK_RESPONSE.result) {
                                    try {
                                        volumesFile = JSON.parse(text);

                                        previousVolumes = volumesFile;

                                        allPreviousCandles.push(previousCandles);
                                        allPreviousVolumes.push(previousVolumes);

                                        controlLoop();

                                    } catch (err) {
                                        logger.write("[ERROR] start -> findPreviousContent -> loopBody -> getVolumes -> onFileReceived -> err = " + err.message);
                                        logger.write("[ERROR] start -> findPreviousContent -> loopBody -> getVolumes -> onFileReceived -> Asuming this is a temporary situation. Requesting a Retry.");
                                        callBackFunction(global.DEFAULT_RETRY_RESPONSE);
                                    }
                                } else {
                                    logger.write("[ERROR] start -> findPreviousContent -> loopBody -> getVolumes -> onFileReceived -> err = " + err.message);
                                    callBackFunction(err);
                                }
                            }
                        } 

                    }

                    function controlLoop() {

                        if (FULL_LOG === true) { logger.write("[INFO] start -> findPreviousContent -> controlLoop -> Entering function."); }

                        n++;

                        if (n < global.marketFilesPeriods.length) {

                            loopBody();

                        } else {

                            buildCandles(allPreviousCandles, allPreviousVolumes);

                        }
                    }
                }
                catch (err) {
                logger.write("[ERROR] start -> findPreviousContent -> err = " + err.message);
                callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                }
            }

            function buildCandles(allPreviousCandles, allPreviousVolumes) {

                try {

                    if (FULL_LOG === true) { logger.write("[INFO] start -> buildCandles -> Entering function."); }

                    /*

                    Firstly we prepere the arrays that will accumulate all the information for each output file.

                    */

                    let outputCandles = [];
                    let outputVolumes = [];

                    for (n = 0; n < global.marketFilesPeriods.length; n++) {

                        const emptyArray1 = [];
                        const emptyArray2 = [];

                        outputCandles.push(emptyArray1);
                        outputVolumes.push(emptyArray2);

                    }

                    advanceTime();

                    function advanceTime() {

                        if (FULL_LOG === true) { logger.write("[INFO] start -> buildCandles -> advanceTime -> Entering function."); }

                        lastCandleFile = new Date(lastCandleFile.valueOf() + ONE_DAY_IN_MILISECONDS);

                        if (FULL_LOG === true) { logger.write("[INFO] start -> buildCandles -> advanceTime -> New processing time @ " + lastCandleFile.getUTCFullYear() + "/" + (lastCandleFile.getUTCMonth() + 1) + "/" + lastCandleFile.getUTCDate() + "."); }

                        /* Validation that we are not going past the head of the market. */

                        if (lastCandleFile.valueOf() > maxCandleFile.valueOf()) {

                            nextIntervalExecution = true;  // we request a new interval execution.

                            if (FULL_LOG === true) { logger.write("[INFO] start -> buildCandles -> advanceTime -> Head of the market found @ " + lastCandleFile.getUTCFullYear() + "/" + (lastCandleFile.getUTCMonth() + 1) + "/" + lastCandleFile.getUTCDate() + "."); }

                            callBackFunction(global.DEFAULT_OK_RESPONSE); // Here is where we finish processing and wait for the platform to run this module again.
                            return;
                        }

                        periodsLoop();

                    }

                    function periodsLoop() {

                        if (FULL_LOG === true) { logger.write("[INFO] start -> buildCandles -> periodsLoop -> Entering function."); }

                        /*
        
                        We will iterate through all posible periods.
        
                        */

                        let n = 0   // loop Variable representing each possible period as defined at the periods array.

                        loopBody();

                        function loopBody() {

                            if (FULL_LOG === true) { logger.write("[INFO] start -> buildCandles -> periodsLoop -> loopBody -> Entering function."); }

                            let previousCandles;
                            let previousVolumes;

                            if (allPreviousCandles !== undefined) {

                                previousCandles = allPreviousCandles[n];
                                previousVolumes = allPreviousVolumes[n];

                            }

                            const outputPeriod = global.marketFilesPeriods[n][0];
                            const folderName = global.marketFilesPeriods[n][1];

                            /* Lest see if we are adding previous candles. */

                            if (previousCandles !== undefined) {

                                for (let i = 0; i < previousCandles.length; i++) {

                                    let candle = {
                                        open: previousCandles[i][2],
                                        close: previousCandles[i][3],
                                        min: previousCandles[i][0],
                                        max: previousCandles[i][1],
                                        begin: previousCandles[i][4],
                                        end: previousCandles[i][5]
                                    };

                                    if (candle.end < lastCandleFile.valueOf()) {

                                        outputCandles[n].push(candle);

                                    } else {
                                        if (FULL_LOG === true) { logger.write("[INFO] start -> buildCandles -> periodsLoop -> loopBody -> Candle # " + i + " @ " + folderName + " discarded for closing past the current process time."); }
                                    }
                                }
                                allPreviousCandles[n] = []; // erasing these so as not to duplicate them.
                            }

                            if (previousVolumes !== undefined) {

                                for (let i = 0; i < previousVolumes.length; i++) {

                                    let volume = {
                                        begin: previousVolumes[i][2],
                                        end: previousVolumes[i][3],
                                        buy: previousVolumes[i][0],
                                        sell: previousVolumes[i][1]
                                    };

                                    if (volume.end < lastCandleFile.valueOf()) {

                                        outputVolumes[n].push(volume);

                                    } else {
                                        if (FULL_LOG === true) {logger.write("[INFO] start -> buildCandles -> periodsLoop -> loopBody -> Volume # " + i + " @ " + folderName + " discarded for closing past the current process time."); }
                                    }
                                }
                                allPreviousVolumes[n] = []; // erasing these so as not to duplicate them.
                            }

                            nextCandleFile();

                            function nextCandleFile() {

                                if (FULL_LOG === true) { logger.write("[INFO] start -> buildCandles -> periodsLoop -> loopBody -> nextCandleFile -> Entering function."); }

                                let dateForPath = lastCandleFile.getUTCFullYear() + '/' + utilities.pad(lastCandleFile.getUTCMonth() + 1, 2) + '/' + utilities.pad(lastCandleFile.getUTCDate(), 2);
                                let fileName = market.assetA + '_' + market.assetB + ".json"
                                let filePath = EXCHANGE_NAME + "/Output/" + CANDLES_FOLDER_NAME + '/' + CANDLES_ONE_MIN + '/' + dateForPath;

                                if (FULL_LOG === true) { logger.write("[INFO] start -> buildCandles -> periodsLoop -> loopBody -> nextCandleFile -> fileName = " + fileName); }
                                if (FULL_LOG === true) { logger.write("[INFO] start -> buildCandles -> periodsLoop -> loopBody -> nextCandleFile -> filePath = " + filePath); }

                                bruceAzureFileStorage.getTextFile(filePath, fileName, onFileReceived, true);

                                function onFileReceived(err, text) {

                                    if (FULL_LOG === true) { logger.write("[INFO] start -> buildCandles -> periodsLoop -> loopBody -> nextCandleFile -> onFileReceived -> Entering function."); }
                                    if (LOG_FILE_CONTENT === true) { logger.write("[INFO] start -> buildCandles -> periodsLoop -> loopBody -> nextCandleFile -> onFileReceived -> text = " + text); }

                                    let candlesFile;

                                    if (err.result === global.CUSTOM_OK_RESPONSE.result) {
                                        try {
                                            candlesFile = JSON.parse(text);

                                        } catch (err) {
                                            logger.write("[ERROR] start -> buildCandles -> periodsLoop -> loopBody -> nextCandleFile -> onFileReceived -> err = " + err.message);
                                            logger.write("[ERROR] start -> buildCandles -> periodsLoop -> loopBody -> nextCandleFile -> onFileReceived -> Asuming this is a temporary situation. Requesting a Retry.");
                                            callBackFunction(global.DEFAULT_RETRY_RESPONSE);
                                        }
                                    } else {
                                        logger.write("[ERROR] start -> buildCandles -> periodsLoop -> loopBody -> nextCandleFile -> onFileReceived -> err = " + err.message);
                                        callBackFunction(err);
                                    }

                                    const inputCandlesPerdiod = 60 * 1000;              // 1 min
                                    const inputFilePeriod = 24 * 60 * 60 * 1000;        // 24 hs

                                    let totalOutputCandles = inputFilePeriod / outputPeriod; // this should be 2 in this case.
                                    let beginingOutputTime = lastCandleFile.valueOf();

                                    for (let i = 0; i < totalOutputCandles; i++) {

                                        let outputCandle = {
                                            open: 0,
                                            close: 0,
                                            min: 0,
                                            max: 0,
                                            begin: 0,
                                            end: 0
                                        };

                                        let saveCandle = false;

                                        outputCandle.begin = beginingOutputTime + i * outputPeriod;
                                        outputCandle.end = beginingOutputTime + (i + 1) * outputPeriod - 1;

                                        for (let j = 0; j < candlesFile.length; j++) {

                                            let candle = {
                                                open: candlesFile[j][2],
                                                close: candlesFile[j][3],
                                                min: candlesFile[j][0],
                                                max: candlesFile[j][1],
                                                begin: candlesFile[j][4],
                                                end: candlesFile[j][5]
                                            };

                                            /* Here we discard all the candles out of range.  */

                                            if (candle.begin >= outputCandle.begin && candle.end <= outputCandle.end) {

                                                if (saveCandle === false) { // this will set the value only once.

                                                    outputCandle.open = candle.open;
                                                    outputCandle.min = candle.min;
                                                    outputCandle.max = candle.max;

                                                }

                                                saveCandle = true;

                                                outputCandle.close = candle.close;      // only the last one will be saved

                                                if (candle.min < outputCandle.min) {

                                                    outputCandle.min = candle.min;

                                                }

                                                if (candle.max > outputCandle.max) {

                                                    outputCandle.max = candle.max;

                                                }
                                            }
                                        }

                                        if (saveCandle === true) {      // then we have a valid candle, otherwise it means there were no candles to fill this one in its time range.

                                            outputCandles[n].push(outputCandle);

                                        }
                                    }

                                    nextVolumeFile();

                                }
                            }

                            function nextVolumeFile() {

                                if (FULL_LOG === true) { logger.write("[INFO] start -> buildCandles -> periodsLoop -> loopBody -> nextVolumeFile -> Entering function."); }

                                let dateForPath = lastCandleFile.getUTCFullYear() + '/' + utilities.pad(lastCandleFile.getUTCMonth() + 1, 2) + '/' + utilities.pad(lastCandleFile.getUTCDate(), 2);
                                let fileName = market.assetA + '_' + market.assetB + ".json"
                                let filePath = EXCHANGE_NAME + "/Output/" + VOLUMES_FOLDER_NAME + '/' + VOLUMES_ONE_MIN + '/' + dateForPath;

                                bruceAzureFileStorage.getTextFile(filePath, fileName, onFileReceived, true);

                                function onFileReceived(text) {

                                    if (FULL_LOG === true) { logger.write("[INFO] start -> buildCandles -> periodsLoop -> loopBody -> nextVolumeFile -> onFileReceived -> Entering function."); }
                                    if (FULL_LOG === true) { logger.write("[INFO] start -> buildCandles -> periodsLoop -> loopBody -> nextVolumeFile -> onFileReceived -> text = " + text); }

                                    let volumesFile;

                                    try {

                                        volumesFile = JSON.parse(text);

                                    } catch (err) {

                                        const logText = "[ERR] 'buildCandles' - Empty or corrupt candle file found at " + filePath + " for market " + market.assetA + '_' + market.assetB + " . Skipping this Market. ";
                                        logger.write(logText);

                                        

                                        return;
                                    }

                                    const inputVolumesPerdiod = 60 * 1000;              // 1 min
                                    const inputFilePeriod = 24 * 60 * 60 * 1000;        // 24 hs

                                    let totalOutputVolumes = inputFilePeriod / outputPeriod; // this should be 2 in this case.
                                    let beginingOutputTime = lastCandleFile.valueOf();

                                    for (let i = 0; i < totalOutputVolumes; i++) {

                                        let outputVolume = {
                                            buy: 0,
                                            sell: 0,
                                            begin: 0,
                                            end: 0
                                        };

                                        let saveVolume = false;

                                        outputVolume.begin = beginingOutputTime + i * outputPeriod;
                                        outputVolume.end = beginingOutputTime + (i + 1) * outputPeriod - 1;

                                        for (let j = 0; j < volumesFile.length; j++) {

                                            let volume = {
                                                buy: volumesFile[j][0],
                                                sell: volumesFile[j][1],
                                                begin: volumesFile[j][2],
                                                end: volumesFile[j][3]
                                            };

                                            /* Here we discard all the Volumes out of range.  */

                                            if (volume.begin >= outputVolume.begin && volume.end <= outputVolume.end) {

                                                saveVolume = true;

                                                outputVolume.buy = outputVolume.buy + volume.buy;
                                                outputVolume.sell = outputVolume.sell + volume.sell;

                                            }
                                        }

                                        if (saveVolume === true) {

                                            outputVolumes[n].push(outputVolume);

                                        }
                                    }

                                    writeFiles(outputCandles[n], outputVolumes[n], folderName, controlLoop);

                                }
                            }
                        }

                        function controlLoop() {

                            if (FULL_LOG === true) { logger.write("[INFO] start -> buildCandles -> periodsLoop -> controlLoop -> Entering function."); }

                            n++;

                            if (n < global.marketFilesPeriods.length) {

                                loopBody();

                            } else {

                                writeStatusReport(lastCandleFile, advanceTime);

                            }
                        }
                    }
                }
                catch (err) {
                    logger.write("[ERROR] start -> buildCandles -> err = " + err.message);
                    callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                }
            }

            function writeFiles(candles, volumes, folderName, callBack) {

                if (FULL_LOG === true) { logger.write("[INFO] start -> writeFiles -> Entering function."); }

                /*

                Here we will write the contents of the Candles and Volumens files.

                */

                try {

                    writeCandles();

                    function writeCandles() {

                        if (FULL_LOG === true) { logger.write("[INFO] start -> writeFiles -> writeCandles -> Entering function."); }

                        let separator = "";
                        let fileRecordCounter = 0;

                        let fileContent = "";

                        for (i = 0; i < candles.length; i++) {

                            let candle = candles[i];

                            fileContent = fileContent + separator + '[' + candles[i].min + "," + candles[i].max + "," + candles[i].open + "," + candles[i].close + "," + candles[i].begin + "," + candles[i].end + "]";

                            if (separator === "") { separator = ","; }

                            fileRecordCounter++;

                        }

                        fileContent = "[" + fileContent + "]";

                        let fileName = '' + market.assetA + '_' + market.assetB + '.json';

                        let filePath = EXCHANGE_NAME + "/Output/" + CANDLES_FOLDER_NAME + "/" + bot.process + "/" + folderName;

                        utilities.createFolderIfNeeded(filePath, oliviaAzureFileStorage, onFolderCreated);

                        function onFolderCreated() {

                            if (FULL_LOG === true) { logger.write("[INFO] start -> writeFiles -> writeCandles -> onFolderCreated -> Entering function."); }

                            oliviaAzureFileStorage.createTextFile(filePath, fileName, fileContent + '\n', onFileCreated);

                            function onFileCreated() {

                                if (FULL_LOG === true) { logger.write("[INFO] start -> writeFiles -> writeCandles -> onFolderCreated -> onFileCreated -> Entering function."); }

                                logger.write("[WARN] Finished with File @ " + market.assetA + "_" + market.assetB + ", " + fileRecordCounter + " records inserted into " + filePath + "/" + fileName );

                                writeVolumes();
                            }
                        }

                    }

                    function writeVolumes() {

                        if (FULL_LOG === true) { logger.write("[INFO] start -> writeFiles -> writeVolumes -> Entering function."); }

                        let separator = "";
                        let fileRecordCounter = 0;

                        let fileContent = "";

                        for (i = 0; i < volumes.length; i++) {

                            let candle = volumes[i];

                            fileContent = fileContent + separator + '[' + volumes[i].buy + "," + volumes[i].sell + "," + volumes[i].begin + "," + volumes[i].end + "]";

                            if (separator === "") { separator = ","; }

                            fileRecordCounter++;

                        }

                        fileContent = "[" + fileContent + "]";

                        let fileName = '' + market.assetA + '_' + market.assetB + '.json';

                        let filePath = EXCHANGE_NAME + "/Output/" + VOLUMES_FOLDER_NAME + "/" + bot.process + "/" + folderName;

                        utilities.createFolderIfNeeded(filePath, oliviaAzureFileStorage, onFolderCreated);

                        function onFolderCreated() {

                            if (FULL_LOG === true) { logger.write("[INFO] start -> writeFiles -> writeVolumes -> onFolderCreated -> Entering function."); }

                            oliviaAzureFileStorage.createTextFile(filePath, fileName, fileContent + '\n', onFileCreated);

                            function onFileCreated() {

                                if (FULL_LOG === true) { logger.write("[INFO] start -> writeFiles -> writeVolumes -> onFolderCreated -> onFileCreated -> Entering function."); }

                                logger.write("[WARN] Finished with File @ " + market.assetA + "_" + market.assetB + ", " + fileRecordCounter + " records inserted into " + filePath + "/" + fileName);

                                callBack();
                            }
                        }
                    }
                }           
                catch (err) {
                logger.write("[ERROR] start -> writeFiles -> err = " + err.message);
                callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                }
            }

            function writeStatusReport(lastFileDate, callBack) {

                if (FULL_LOG === true) { logger.write("[INFO] start -> writeStatusReport -> Entering function."); }
                if (FULL_LOG === true) { logger.write("[INFO] start -> writeStatusReport -> lastFileDate = " + lastFileDate); }

                try {

                    statusReport.lastExecution = global.processDatetime;
                    statusReportModule.save(callBack);

                }
                catch (err) {
                    logger.write("[ERROR] start -> writeStatusReport -> err = " + err.message);
                    callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                }
            }

        }
        catch (err) {
            logger.write("[ERROR] start -> err = " + err.message);
            callBackFunction(global.DEFAULT_FAIL_RESPONSE);
        }
    }
};
