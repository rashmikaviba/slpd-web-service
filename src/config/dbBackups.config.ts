import { exec } from 'child_process'
import schedule from 'node-schedule'
import * as fs from 'fs'
import * as path from 'path'
import { envConfig } from './environment.config'

const execShellCommand = (cmd: string) => {
    return new Promise<string>((resolve, reject) => {
        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error executing command: ${cmd}`);
                console.error(`Error: ${error.message}`);
                console.error(`Stderr: ${stderr}`);
                reject(error); // Reject the promise on error
                return;
            }
            resolve(stdout ? stdout : stderr)
        })
    })
}

export const cronJob = (cronTime: string, callback: () => void) => {
    schedule.scheduleJob(cronTime, callback)
}

const performBackup = async () => {
    const date = new Date().toISOString().replace(/:/g, '-') // Replace colons in date for filename compatibility
    const backupDir = `./backups/mongo-backup-${date}`
    const cmd = `mongodump --uri="${envConfig.MONGO_URL}" --out=${backupDir}`

    try {
        const output = await execShellCommand(cmd)
        console.log(`Backup successful: ${output}`)

        // Manage backup history: keep only the latest 3 backups
        const backupFiles = fs
            .readdirSync('./backups')
            .filter((file) => file.startsWith('mongo-backup-'))
            .sort()
        if (backupFiles.length > 3) {
            const filesToDelete = backupFiles.slice(0, backupFiles.length - 3) // Calculate number of files to delete
            filesToDelete.forEach((file) => {
                const filePath = path.join('./backups', file)
                fs.rmSync(filePath, { recursive: true }) // Delete backup directory
                console.log(`Deleted old backup: ${file}`)
            })
        }
    } catch (error) {
        console.error(`Error during backup: ${error}`)
    }
}

// Schedule the backup to run daily at 2:00 A
const runDBBackup = () => {
    cronJob('0 2 * * *', async () => {
        console.log(`Running backup at ${new Date().toISOString()}..!`)
        await performBackup()
    })
}

export default runDBBackup
