// We load the plugin here.
import '@collabland/typechain-hardhat'
import '@nomicfoundation/hardhat-ethers'

import type { HardhatUserConfig } from 'hardhat/types'

const config: HardhatUserConfig = {
  solidity: '0.8.7',
  defaultNetwork: 'hardhat',
}

export default config
